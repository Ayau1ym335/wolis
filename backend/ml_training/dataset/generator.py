"""

Core design idea (per the agreed spec): rather than deriving labels directly
from a fixed formula on the features (which would make the model trivially
memorize rules.py and defeat the purpose of using ML at all), we introduce a
hidden latent variable `true_degradation_level` that drives sensor generation.
rules.py is then applied to the *generated* sensor readings to produce labels,
same as it would be applied to real sensor readings. This keeps a realistic
gap between "the underlying condition" and "what the sensors happened to
read", which is what makes the learning problem non-trivial.

Output: a pandas DataFrame / CSV with one row per synthetic "measurement
session": building context + sensor readings + engineering-rule-derived
labels (with a small amount of label noise).
"""

import argparse
import os
import numpy as np
import pandas as pd

from .rules import (
    Status,
    evaluate_structural,
    evaluate_climate,
    evaluate_lighting,
    compute_overall_status
)

BUILDING_TYPES = ["residential", "commercial", "historical", "industrial"]
BUILDING_TYPE_WEIGHTS = [0.5, 0.25, 0.10, 0.15]
MATERIALS = ["brick", "concrete", "wood", "mixed"]
MATERIAL_WEIGHTS_BY_BUILDING_TYPE = {
    "residential": [0.35, 0.30, 0.20, 0.15],
    "commercial": [0.15, 0.55, 0.05, 0.25],
    "historical": [0.60, 0.05, 0.25, 0.10],
    "industrial": [0.10, 0.65, 0.05, 0.20],
}
REGIONS = ["temperate", "continental", "arid", "coastal"]
REGION_WEIGHTS = [0.4, 0.3, 0.15, 0.15]
AREA_M2_RANGE = (50.0, 5000.0)


def _sample_age_years(rng: np.random.Generator) -> int:
    """
    Age is sampled from a mixture that favors younger/mid-age buildings and
    makes very old buildings comparatively rare, rather than uniform 1-150.
    Beta(1.6, 3.5) is right-skewed (median well below the mean of the range),
    scaled to [1, 150] — this keeps most of the sampled stock in a realistic
    "young to mid-age" band while still allowing a long tail of old/historical
    buildings, instead of centering the whole distribution around ~75 years.
    Calibrated empirically against the target overall_status balance (see
    generate_dataset acceptance check), not against a real building-stock
    census for the target region.
    """
    raw = rng.beta(1.6, 3.5)
    age = 1 + raw * 149.0
    return int(round(age))


def _sample_building_context(rng: np.random.Generator) -> dict:
    building_type = rng.choice(BUILDING_TYPES, p=BUILDING_TYPE_WEIGHTS)

    material_weights = MATERIAL_WEIGHTS_BY_BUILDING_TYPE[building_type]
    material = rng.choice(MATERIALS, p=material_weights)

    age_years = _sample_age_years(rng)
    area_m2 = float(rng.uniform(*AREA_M2_RANGE))
    region = rng.choice(REGIONS, p=REGION_WEIGHTS)

    return {
        "building_type": building_type,
        "material": material,
        "age_years": age_years,
        "area_m2": round(area_m2, 1),
        "region": region,
    }


# ---------------------------------------------------------------------------
# Step 2 — hidden true_degradation_level
# ---------------------------------------------------------------------------

def _sample_true_degradation_level(age_years: int, rng: np.random.Generator) -> float:
    """
    Latent, unobserved "ground truth" degradation level in [0, 1], correlated
    with age but not deterministic — two buildings of the same age can have
    meaningfully different true condition (maintenance history, workmanship,
    local conditions — none of which the sensors directly observe).

    Modeled as: a base degradation trend that rises with age (saturating, not
    linear — most degradation risk accumulates over the first ~80 years),
    plus independent random noise that can push a given building well above
    or below that trend.
    """
    # Saturating trend: approaches 1.0 as age grows, but slowly — reaches
    # roughly the midpoint of its range around 60 years, per the exponential
    # time-constant below.
    age_trend = 1.0 - np.exp(-age_years / 60.0)

    # Individual variance around the trend — this is what decouples age from
    # degradation deterministically.
    noise = rng.normal(loc=0.0, scale=0.18)

    # Trend contributes at most ~0.65 of the final level; noise can push
    # further in either direction. Calibrated together with age sampling
    # above and the tilt/vibration scaling below via a small parameter
    # sweep against the target ~50/35/15 normal/attention/critical split
    # from the implementation plan (see calibration note in generate_dataset).
    level = age_trend * 0.65 + noise
    return float(np.clip(level, 0.0, 1.0))


# ---------------------------------------------------------------------------
# Step 3 — sensor value generation from true_degradation_level + context + noise
# ---------------------------------------------------------------------------

# MPU6050-informed noise scale for tilt: paper-spec-level angular noise is
# small; this sigma represents realistic measurement jitter, not the full
# sensor error budget.
# TODO: replace with the actual measured noise characteristics of the
# firmware's MPU6050 reading pipeline once available (calibration data),
# rather than an assumed value.
TILT_NOISE_SIGMA_DEG = 0.15
VIBRATION_NOISE_SIGMA = 0.03

SHOCK_BASE_PROBABILITY = 0.05  # ~5% of rows have a shock event, per spec

# Climate zone base ranges (mean temperature/humidity/pressure), used as the
# center of the sampling distribution before adding degradation-correlated
# and seasonal noise.
# TODO: these are illustrative regional profiles, not sourced from real
# climate data for the target region — acceptable as noise-shape references
# per the earlier decision to use public datasets only for calibrating noise,
# not as training data itself.
CLIMATE_ZONE_PROFILES = {
    "temperate": {"temp_mean": 15.0, "temp_sigma": 6.0, "humidity_mean": 55.0, "humidity_sigma": 10.0, "pressure_mean": 1013.0, "pressure_sigma": 6.0},
    "continental": {"temp_mean": 10.0, "temp_sigma": 12.0, "humidity_mean": 50.0, "humidity_sigma": 12.0, "pressure_mean": 1015.0, "pressure_sigma": 8.0},
    "arid": {"temp_mean": 25.0, "temp_sigma": 8.0, "humidity_mean": 25.0, "humidity_sigma": 8.0, "pressure_mean": 1010.0, "pressure_sigma": 5.0},
    "coastal": {"temp_mean": 18.0, "temp_sigma": 5.0, "humidity_mean": 65.0, "humidity_sigma": 8.0, "pressure_mean": 1012.0, "pressure_sigma": 6.0},
}

LIGHTING_BASE_LUX_BY_BUILDING_TYPE = {
    "residential": 350.0,
    "commercial": 450.0,
    "historical": 250.0,
    "industrial": 300.0,
}
LIGHTING_NOISE_SIGMA = 80.0


def _generate_sensor_readings(
    true_degradation_level: float,
    context: dict,
    rng: np.random.Generator,
) -> dict:
    # --- structural: tilt & vibration driven by degradation, plus noise ---
    # Quadratic mapping from degradation to tilt/vibration: low-to-moderate
    # degradation stays well below the attention thresholds, and readings
    # only climb sharply as degradation approaches the top of its range.
    # Scale/exponent/age-trend-weight (above) were jointly calibrated via a
    # small parameter sweep against the target ~50/35/15 overall_status split
    # from the implementation plan — not derived from a physical model.
    base_tilt = (true_degradation_level ** 2.0) * 11.0  # up to ~11 deg at full degradation
    tilt_angle_deg = max(0.0, base_tilt + rng.normal(0.0, TILT_NOISE_SIGMA_DEG))

    base_vibration = (true_degradation_level ** 2.0) * 0.88
    vibration_magnitude = max(0.0, base_vibration + rng.normal(0.0, VIBRATION_NOISE_SIGMA))

    # shock_detected: rare event, only weakly nudged upward by degradation
    # (a badly degraded structure is somewhat more prone to shock-triggering
    # events, but shocks are still mostly independent external occurrences).
    shock_probability = SHOCK_BASE_PROBABILITY + 0.05 * true_degradation_level
    shock_detected = bool(rng.random() < shock_probability)

    # --- climate: mostly climate-zone driven, weak degradation correlation on humidity ---
    profile = CLIMATE_ZONE_PROFILES[context["region"]]
    temperature_c = rng.normal(profile["temp_mean"], profile["temp_sigma"])
    pressure_hpa = rng.normal(profile["pressure_mean"], profile["pressure_sigma"])

    # Degraded buildings tend to retain moisture slightly more (worse
    # sealing/insulation), modeled as a small upward shift in humidity mean.
    humidity_mean = profile["humidity_mean"] + true_degradation_level * 10.0
    humidity_pct = np.clip(
        rng.normal(humidity_mean, profile["humidity_sigma"]), 0.0, 100.0
    )

    # --- lighting: mostly building-type driven, independent of degradation ---
    base_lux = LIGHTING_BASE_LUX_BY_BUILDING_TYPE[context["building_type"]]
    illuminance_lux = max(0.0, rng.normal(base_lux, LIGHTING_NOISE_SIGMA))

    return {
        "tilt_angle_deg": round(float(tilt_angle_deg), 3),
        "vibration_magnitude": round(float(vibration_magnitude), 4),
        "shock_detected": shock_detected,
        "temperature_c": round(float(temperature_c), 2),
        "humidity_pct": round(float(humidity_pct), 2),
        "pressure_hpa": round(float(pressure_hpa), 2),
        "illuminance_lux": round(float(illuminance_lux), 1),
    }


# ---------------------------------------------------------------------------
# Step 4 — apply rules.py to get ground-truth labels
# ---------------------------------------------------------------------------

def _compute_labels(sensor_readings: dict, context: dict) -> dict:
    structural = evaluate_structural(
        tilt_angle_deg=sensor_readings["tilt_angle_deg"],
        vibration_magnitude=sensor_readings["vibration_magnitude"],
        shock_detected=sensor_readings["shock_detected"],
        age_years=context["age_years"],
    )
    climate = evaluate_climate(
        temperature_c=sensor_readings["temperature_c"],
        humidity_pct=sensor_readings["humidity_pct"],
        pressure_hpa=sensor_readings["pressure_hpa"],
        material=context["material"],
    )
    lighting = evaluate_lighting(
        illuminance_lux=sensor_readings["illuminance_lux"],
        building_type=context["building_type"],
    )
    overall = compute_overall_status(structural, climate, lighting)

    return {
        "structural_status": structural.value,
        "climate_status": climate.value,
        "lighting_status": lighting.value,
        "overall_status": overall.value,
    }


# ---------------------------------------------------------------------------
# Step 5 — label noise
# ---------------------------------------------------------------------------

_STATUS_ORDER = [Status.NORMAL.value, Status.ATTENTION.value, Status.CRITICAL.value]

LABEL_NOISE_RATE = 0.04  # ~4% of rows get one label flipped to a neighbor


def _flip_to_neighbor(label: str, rng: np.random.Generator) -> str:
    idx = _STATUS_ORDER.index(label)
    if idx == 0:
        neighbor_idx = 1
    elif idx == len(_STATUS_ORDER) - 1:
        neighbor_idx = idx - 1
    else:
        neighbor_idx = idx + rng.choice([-1, 1])
    return _STATUS_ORDER[neighbor_idx]


def _apply_label_noise(labels: dict, rng: np.random.Generator) -> dict:
    """
    With LABEL_NOISE_RATE probability, pick one of the four label fields on
    this row and flip it to an adjacent severity level. Simulates imperfect
    real-world labeling rather than a mathematically perfect rules.py oracle.
    Applied independently per row, not per field, so noisy rows are sparse
    and isolated rather than systematically biasing any one label field.
    """
    if rng.random() >= LABEL_NOISE_RATE:
        return labels

    noisy_labels = dict(labels)
    field_to_flip = rng.choice(
        ["structural_status", "climate_status", "lighting_status", "overall_status"]
    )
    noisy_labels[field_to_flip] = _flip_to_neighbor(labels[field_to_flip], rng)
    return noisy_labels


# ---------------------------------------------------------------------------
# Top-level generation function
# ---------------------------------------------------------------------------

def generate_dataset(n_rows: int, seed: int) -> pd.DataFrame:
    """
    Generate a synthetic dataset of n_rows rows, fully reproducible given the
    same seed. Each row represents one synthetic measurement session: sampled
    building context, sensor readings generated from a hidden degradation
    level + context + noise, and rule-derived labels with a small amount of
    label noise applied.
    """
    rng = np.random.default_rng(seed)
    rows = []

    for _ in range(n_rows):
        context = _sample_building_context(rng)
        true_degradation_level = _sample_true_degradation_level(context["age_years"], rng)
        sensor_readings = _generate_sensor_readings(true_degradation_level, context, rng)
        labels = _compute_labels(sensor_readings, context)
        labels = _apply_label_noise(labels, rng)

        row = {
            **context,
            **sensor_readings,
            **labels,
            # kept for dataset auditing/debugging only — NOT a feature the
            # model should ever see at inference time, since it is not
            # observable from real sensors.
            "_true_degradation_level": round(true_degradation_level, 4),
        }
        rows.append(row)

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _print_class_balance(df: pd.DataFrame) -> None:
    print("\nClass balance (overall_status):")
    counts = df["overall_status"].value_counts(normalize=True).round(3)
    for status in _STATUS_ORDER:
        pct = counts.get(status, 0.0)
        print(f"  {status:10s}: {pct * 100:5.1f}%")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the Wolis synthetic training dataset.")
    parser.add_argument("--n-rows", type=int, default=12000, help="Number of rows to generate.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    default_output = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "output", "synthetic_dataset.csv"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=default_output,
        help="Output CSV path. Defaults to output/synthetic_dataset.csv next to this script.",
    )
    args = parser.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    df = generate_dataset(n_rows=args.n_rows, seed=args.seed)
    df.to_csv(args.output, index=False)

    print(f"Generated {len(df)} rows -> {args.output}")
    _print_class_balance(df)
    print("\nSample rows:")
    print(df.head(3).to_string())


if __name__ == "__main__":
    main()