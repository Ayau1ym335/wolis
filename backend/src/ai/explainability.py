"""
ai/explainability.py

Two separate explainability sources (as agreed):
  1. Static feature importances from the RF model  -> feature_weights in ParameterFlag
  2. Per-instance threshold comparison from rules.py -> threshold_description in ParameterFlag
"""
from __future__ import annotations
import math
from typing import Any

from ml_training.dataset.rules import (
    STRUCTURAL_TILT_THRESHOLDS_DEG,
    STRUCTURAL_VIBRATION_THRESHOLDS,
    CLIMATE_HUMIDITY_THRESHOLDS_BY_MATERIAL,
    TEMPERATURE_ATTENTION_RANGE_C,
    PRESSURE_ATTENTION_RANGE_HPA,
    LIGHTING_THRESHOLDS_LUX_BY_BUILDING_TYPE,
)
from src.ai.concerns import GROUP_CONTRIBUTING_SENSORS
from src.types.assessment import FeatureWeight, SensorData, BuildingContext

# ---------------------------------------------------------------------------
# Sensor human-readable labels (same as frontend SENSOR_LABELS)
# ---------------------------------------------------------------------------
SENSOR_LABELS: dict[str, str] = {
    "tilt_angle_deg":       "Угол наклона",
    "vibration_magnitude":  "Вибрация",
    "shock_detected":       "Ударная нагрузка",
    "humidity_pct":         "Влажность",
    "temperature_c":        "Температура",
    "pressure_hpa":         "Давление",
    "illuminance_lux":      "Освещённость",
}

# Feature column order from metadata.json (encoded_feature_names before one-hot)
_RAW_SENSOR_FEATURES = [
    "temperature_c", "humidity_pct", "pressure_hpa",
    "illuminance_lux", "tilt_angle_deg", "vibration_magnitude",
    "age_years", "area_m2", "shock_detected",
]

# ---------------------------------------------------------------------------
# 1. Static feature importances from RF model
# ---------------------------------------------------------------------------

def _age_threshold_multiplier(age_years: int) -> float:
    brackets = [(0, 1.0), (30, 0.9), (60, 0.8), (100, 0.7)]
    mult = 1.0
    for min_age, m in brackets:
        if age_years >= min_age:
            mult = m
        else:
            break
    return mult


def extract_feature_weights(
    model: Any,
    group: str,
    encoded_feature_names: list[str],
    top_n: int = 3,
) -> list[FeatureWeight]:
    """
    Extract top-N sensor feature importances from a fitted RandomForest model.

    Only raw sensor features (no one-hot building_type/material/region) are returned,
    normalised so their weights sum to 1.0 within the group's sensor features.
    """
    if not hasattr(model, "feature_importances_"):
        return _rule_based_uniform_weights(group)

    importances = model.feature_importances_
    sensor_features = GROUP_CONTRIBUTING_SENSORS.get(group, [])

    # Map sensor name -> index in encoded_feature_names
    # (encoded names match raw feature names for numeric/bool columns)
    weighted: dict[str, float] = {}
    for sensor in sensor_features:
        if sensor in encoded_feature_names:
            idx = encoded_feature_names.index(sensor)
            if idx < len(importances):
                weighted[sensor] = float(importances[idx])

    if not weighted:
        return _rule_based_uniform_weights(group)

    total = sum(weighted.values())
    if total == 0:
        return _rule_based_uniform_weights(group)

    sorted_items = sorted(weighted.items(), key=lambda x: x[1], reverse=True)[:top_n]
    normalised = [(s, w / total) for s, w in sorted_items]

    return [
        FeatureWeight(sensor=s, weight=round(w, 3), label=SENSOR_LABELS.get(s, s))
        for s, w in normalised
    ]


def _rule_based_uniform_weights(group: str) -> list[FeatureWeight]:
    """Fallback when model has no feature_importances_ (rule-based path)."""
    sensors = GROUP_CONTRIBUTING_SENSORS.get(group, [])
    if not sensors:
        return []
    w = round(1.0 / len(sensors), 3)
    return [
        FeatureWeight(sensor=s, weight=w, label=SENSOR_LABELS.get(s, s))
        for s in sensors
    ]


# ---------------------------------------------------------------------------
# 2. Per-instance threshold explanation
# ---------------------------------------------------------------------------

def build_threshold_description(
    group: str,
    sensor_data: SensorData,
    building_context: BuildingContext,
) -> str:
    """
    Returns a human-readable sentence explaining WHY the group got its status.
    Uses hard thresholds from rules.py, applied to actual sensor values.

    Examples:
      "Наклон 3.2° превышает норму 0.9° для данного здания (кирпич, 45 лет)"
      "Влажность 82% превышает критический порог 80% для кирпичного здания"
      "Освещённость 45 лк ниже нормы 100 лк для жилого здания"
    """
    if group == "structural":
        return _structural_description(sensor_data, building_context)
    elif group == "climate":
        return _climate_description(sensor_data, building_context)
    elif group == "lighting":
        return _lighting_description(sensor_data, building_context)
    return ""


def _structural_description(sensor_data: SensorData, ctx: BuildingContext) -> str:
    mult = _age_threshold_multiplier(ctx.age_years)
    tilt_crit = round(STRUCTURAL_TILT_THRESHOLDS_DEG["critical"] * mult, 2)
    tilt_att  = round(STRUCTURAL_TILT_THRESHOLDS_DEG["attention"] * mult, 2)
    vib_crit  = round(STRUCTURAL_VIBRATION_THRESHOLDS["critical"] * mult, 3)
    vib_att   = round(STRUCTURAL_VIBRATION_THRESHOLDS["attention"] * mult, 3)

    parts: list[str] = []
    mat_label = ctx.material.value
    age_label = f"{ctx.age_years} лет"

    if sensor_data.tilt_angle_deg >= tilt_crit:
        parts.append(
            f"Наклон {sensor_data.tilt_angle_deg:.2f}° превышает критический порог "
            f"{tilt_crit}° (материал: {mat_label}, возраст: {age_label})"
        )
    elif sensor_data.tilt_angle_deg >= tilt_att:
        parts.append(
            f"Наклон {sensor_data.tilt_angle_deg:.2f}° превышает порог внимания "
            f"{tilt_att}° (материал: {mat_label}, возраст: {age_label})"
        )

    if sensor_data.vibration_magnitude >= vib_crit:
        parts.append(
            f"Вибрация {sensor_data.vibration_magnitude:.3f} g превышает критический "
            f"порог {vib_crit} g"
        )
    elif sensor_data.vibration_magnitude >= vib_att:
        parts.append(
            f"Вибрация {sensor_data.vibration_magnitude:.3f} g превышает порог "
            f"внимания {vib_att} g"
        )

    if sensor_data.shock_detected:
        parts.append("Зафиксирован ударный импульс")

    if not parts:
        parts.append(
            f"Параметры в норме: наклон {sensor_data.tilt_angle_deg:.2f}° "
            f"(норма < {tilt_att}°), вибрация {sensor_data.vibration_magnitude:.3f} g "
            f"(норма < {vib_att} g)"
        )

    return "; ".join(parts)


def _climate_description(sensor_data: SensorData, ctx: BuildingContext) -> str:
    mat_key = ctx.material.value.lower()
    thresholds = CLIMATE_HUMIDITY_THRESHOLDS_BY_MATERIAL.get(
        mat_key, CLIMATE_HUMIDITY_THRESHOLDS_BY_MATERIAL["mixed"]
    )
    parts: list[str] = []

    if sensor_data.humidity_pct >= thresholds["critical"]:
        parts.append(
            f"Влажность {sensor_data.humidity_pct:.0f}% критически высока "
            f"(порог {thresholds['critical']}% для {mat_key})"
        )
    elif sensor_data.humidity_pct >= thresholds["attention"]:
        parts.append(
            f"Влажность {sensor_data.humidity_pct:.0f}% выше нормы "
            f"(порог внимания {thresholds['attention']}% для {mat_key})"
        )

    temp_low, temp_high = TEMPERATURE_ATTENTION_RANGE_C
    if not (temp_low <= sensor_data.temperature_c <= temp_high):
        direction = "ниже" if sensor_data.temperature_c < temp_low else "выше"
        limit = temp_low if sensor_data.temperature_c < temp_low else temp_high
        parts.append(
            f"Температура {sensor_data.temperature_c:.1f}°C {direction} нормы "
            f"(норма {temp_low}…{temp_high}°C)"
        )

    p_low, p_high = PRESSURE_ATTENTION_RANGE_HPA
    if not (p_low <= sensor_data.pressure_hpa <= p_high):
        parts.append(
            f"Давление {sensor_data.pressure_hpa:.0f} гПа вне нормы "
            f"({p_low}–{p_high} гПа)"
        )

    if not parts:
        parts.append(
            f"Климатические параметры в норме: влажность {sensor_data.humidity_pct:.0f}% "
            f"(норма < {thresholds['attention']}% для {mat_key}), "
            f"температура {sensor_data.temperature_c:.1f}°C"
        )

    return "; ".join(parts)


def _lighting_description(sensor_data: SensorData, ctx: BuildingContext) -> str:
    bt_key = ctx.building_type.value.lower()
    thresholds = LIGHTING_THRESHOLDS_LUX_BY_BUILDING_TYPE.get(
        bt_key, LIGHTING_THRESHOLDS_LUX_BY_BUILDING_TYPE["residential"]
    )
    lux = sensor_data.illuminance_lux

    if lux <= thresholds["critical"]:
        return (
            f"Освещённость {lux:.0f} лк критически мала "
            f"(порог {thresholds['critical']} лк для типа «{bt_key}»)"
        )
    elif lux <= thresholds["attention"]:
        return (
            f"Освещённость {lux:.0f} лк ниже нормы "
            f"(норма > {thresholds['attention']} лк для типа «{bt_key}»)"
        )
    return (
        f"Освещённость {lux:.0f} лк в норме "
        f"(норма > {thresholds['attention']} лк для типа «{bt_key}»)"
    )
