import argparse
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

from ml_training.dataset.rules import (
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

def _sample_true_degradation_level(age_years: int, rng: np.random.Generator) -> float:
    age_trend = 1.0 - np.exp(-age_years / 60.0)
    noise = rng.normal(loc=0.0, scale=0.18)
    level = age_trend * 0.65 + noise
    return float(np.clip(level, 0.0, 1.0))

TILT_NOISE_SIGMA_DEG = 0.15
VIBRATION_NOISE_SIGMA = 0.03
SHOCK_BASE_PROBABILITY = 0.05  

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
    base_tilt = (true_degradation_level ** 2.0) * 11.0 
    tilt_angle_deg = max(0.0, base_tilt + rng.normal(0.0, TILT_NOISE_SIGMA_DEG))

    base_vibration = (true_degradation_level ** 2.0) * 0.88
    vibration_magnitude = max(0.0, base_vibration + rng.normal(0.0, VIBRATION_NOISE_SIGMA))
    shock_probability = SHOCK_BASE_PROBABILITY + 0.05 * true_degradation_level
    shock_detected = bool(rng.random() < shock_probability)
    profile = CLIMATE_ZONE_PROFILES[context["region"]]
    temperature_c = rng.normal(profile["temp_mean"], profile["temp_sigma"])
    pressure_hpa = rng.normal(profile["pressure_mean"], profile["pressure_sigma"])

    humidity_mean = profile["humidity_mean"] + true_degradation_level * 10.0
    humidity_pct = np.clip(
        rng.normal(humidity_mean, profile["humidity_sigma"]), 0.0, 100.0
    )

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

_STATUS_ORDER = [Status.NORMAL.value, Status.ATTENTION.value, Status.CRITICAL.value]
LABEL_NOISE_RATE = 0.04 

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
    if rng.random() >= LABEL_NOISE_RATE:
        return labels

    noisy_labels = dict(labels)
    field_to_flip = rng.choice(
        ["structural_status", "climate_status", "lighting_status", "overall_status"]
    )
    noisy_labels[field_to_flip] = _flip_to_neighbor(labels[field_to_flip], rng)
    return noisy_labels


def generate_dataset(n_rows: int, seed: int) -> pd.DataFrame:
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
        os.path.dirname(os.path.abspath(__file__)), "synthetic_dataset.csv"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=default_output,
        help="Output CSV path. Defaults to synthetic_dataset.csv next to this script.",
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