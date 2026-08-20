from ml_training.dataset.rules import (
    Status as RulesStatus,
    evaluate_structural,
    evaluate_climate,
    evaluate_lighting,
    compute_overall_status,
)
from src.types.assessment import (
    AssessmentResult,
    BuildingContext,
    Confidence,
    ParameterFlag,
    SensorData,
    Status,
)

FALLBACK_CONFIDENCE = Confidence.MEDIUM
FALLBACK_CONFIDENCE_SCORE = 0.6 
GROUP_CONTRIBUTING_SENSORS = {
    "structural": ["tilt_angle_deg", "vibration_magnitude", "shock_detected"],
    "climate": ["humidity_pct", "temperature_c", "pressure_hpa"],
    "lighting": ["illuminance_lux"],
}
STATUS_BASE_RISK_SCORE = {
    RulesStatus.NORMAL: 15.0,
    RulesStatus.ATTENTION: 50.0,
    RulesStatus.CRITICAL: 80.0,
}

RISK_SCORE_WEIGHTS = {"structural": 0.5, "climate": 0.3, "lighting": 0.2}


def _to_result_status(rules_status: RulesStatus) -> Status:
    return Status(rules_status.value)


def _derive_key_concerns(group_statuses: dict[str, RulesStatus], sensor_data: SensorData) -> list[str]:
    concerns: list[str] = []

    if group_statuses["structural"] != RulesStatus.NORMAL:
        if sensor_data.tilt_angle_deg >= 2.0:
            concerns.append("high_tilt")
        if sensor_data.vibration_magnitude >= 0.15:
            concerns.append("structural_vibration")
        if sensor_data.shock_detected:
            concerns.append("shock_event_detected")

    if group_statuses["climate"] != RulesStatus.NORMAL:
        if sensor_data.humidity_pct >= 60.0:
            concerns.append("moisture_risk")
        if not (-15.0 <= sensor_data.temperature_c <= 40.0):
            concerns.append("extreme_temperature")
        if not (950.0 <= sensor_data.pressure_hpa <= 1050.0):
            concerns.append("extreme_pressure")

    if group_statuses["lighting"] != RulesStatus.NORMAL:
        concerns.append("insufficient_natural_light")

    return concerns


def assess_with_rules(sensor_data: SensorData, building_context: BuildingContext) -> AssessmentResult:
    structural = evaluate_structural(
        tilt_angle_deg=sensor_data.tilt_angle_deg,
        vibration_magnitude=sensor_data.vibration_magnitude,
        shock_detected=sensor_data.shock_detected,
        age_years=building_context.age_years,
    )
    climate = evaluate_climate(
        temperature_c=sensor_data.temperature_c,
        humidity_pct=sensor_data.humidity_pct,
        pressure_hpa=sensor_data.pressure_hpa,
        material=building_context.material.value,
    )
    lighting = evaluate_lighting(
        illuminance_lux=sensor_data.illuminance_lux,
        building_type=building_context.building_type.value,
    )
    overall = compute_overall_status(structural, climate, lighting)

    group_statuses = {"structural": structural, "climate": climate, "lighting": lighting}

    overall_risk_score = round(
        sum(
            RISK_SCORE_WEIGHTS[group] * STATUS_BASE_RISK_SCORE[status]
            for group, status in group_statuses.items()
        ),
        1,
    )

    parameter_flags = [
        ParameterFlag(
            group=group,
            status=_to_result_status(status),
            confidence=FALLBACK_CONFIDENCE_SCORE,
            contributing_sensors=GROUP_CONTRIBUTING_SENSORS[group],
        )
        for group, status in group_statuses.items()
    ]

    key_concerns = _derive_key_concerns(group_statuses, sensor_data)

    return AssessmentResult(
        overall_risk_score=overall_risk_score,
        overall_status=_to_result_status(overall),
        confidence=FALLBACK_CONFIDENCE,
        ml_model_used=False,
        model_version=None,
        parameter_flags=parameter_flags,
        key_concerns=key_concerns,
    )
