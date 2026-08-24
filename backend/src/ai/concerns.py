from src.types.assessment import SensorData

GROUP_CONTRIBUTING_SENSORS: dict[str, list[str]] = {
    "structural": ["tilt_angle_deg", "vibration_magnitude", "shock_detected"],
    "climate": ["humidity_pct", "temperature_c", "pressure_hpa"],
    "lighting": ["illuminance_lux"],
}

RISK_SCORE_WEIGHTS: dict[str, float] = {
    "structural": 0.5,
    "climate": 0.3,
    "lighting": 0.2,
}

CONFIDENCE_THRESHOLD: float = 0.5

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
