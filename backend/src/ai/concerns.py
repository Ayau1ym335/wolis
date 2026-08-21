"""
Shared constants and utilities used by both the ML inference path
(ai/inference.py) and the rule-based fallback (ai/fallback/rule_based_assessment.py).

Centralised here so that thresholds and sensor groupings are defined
exactly once - changes propagate to both paths automatically.
"""
from src.types.assessment import SensorData

# Sensor fields that contribute to each assessment group.
# Used when constructing ParameterFlag.contributing_sensors.
GROUP_CONTRIBUTING_SENSORS: dict[str, list[str]] = {
    "structural": ["tilt_angle_deg", "vibration_magnitude", "shock_detected"],
    "climate": ["humidity_pct", "temperature_c", "pressure_hpa"],
    "lighting": ["illuminance_lux"],
}

# Weights for computing the overall risk score from per-group critical probabilities.
RISK_SCORE_WEIGHTS: dict[str, float] = {
    "structural": 0.5,
    "climate": 0.3,
    "lighting": 0.2,
}

# Minimum confidence probability below which a prediction is treated as LOW confidence.
CONFIDENCE_THRESHOLD: float = 0.5

# Sensor thresholds used to derive specific key concerns from group-level statuses.
_TILT_THRESHOLD_DEG = 2.0
_VIBRATION_THRESHOLD_G = 0.15
_HUMIDITY_THRESHOLD_PCT = 60.0
_TEMP_NORMAL_MIN_C = -15.0
_TEMP_NORMAL_MAX_C = 40.0
_PRESSURE_NORMAL_MIN_HPA = 950.0
_PRESSURE_NORMAL_MAX_HPA = 1050.0


def derive_key_concerns(
    group_statuses: dict,
    sensor_data: SensorData,
    normal_value: object,
) -> list[str]:
    """
    Translate group-level statuses + raw sensor readings into a list of
    specific concern keys (e.g. "high_tilt", "moisture_risk").

    normal_value must be the caller's NORMAL Status enum member so this
    function works with both src.types.assessment.StatusLevel and the
    ml_training rules Status (they are structurally identical but separate types).
    """
    concerns: list[str] = []

    if group_statuses["structural"] != normal_value:
        if sensor_data.tilt_angle_deg >= _TILT_THRESHOLD_DEG:
            concerns.append("high_tilt")
        if sensor_data.vibration_magnitude >= _VIBRATION_THRESHOLD_G:
            concerns.append("structural_vibration")
        if sensor_data.shock_detected:
            concerns.append("shock_event_detected")

    if group_statuses["climate"] != normal_value:
        if sensor_data.humidity_pct >= _HUMIDITY_THRESHOLD_PCT:
            concerns.append("moisture_risk")
        if not (_TEMP_NORMAL_MIN_C <= sensor_data.temperature_c <= _TEMP_NORMAL_MAX_C):
            concerns.append("extreme_temperature")
        if not (_PRESSURE_NORMAL_MIN_HPA <= sensor_data.pressure_hpa <= _PRESSURE_NORMAL_MAX_HPA):
            concerns.append("extreme_pressure")

    if group_statuses["lighting"] != normal_value:
        concerns.append("insufficient_natural_light")

    return concerns
