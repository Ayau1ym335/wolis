import math
from src.ai.concerns import CONFIDENCE_THRESHOLD
from src.ai.fallback.rule_based_assessment import assess_with_rules
from src.ai.inference import ModelBundle, predict
from src.types.assessment import AssessmentResult, BuildingContext, Confidence, SensorData, Status, STATUS_RANK
from src.utils.logger import log_event

CRITICAL_CONFLICT_SEVERITY_GAP = 2


def validate_schema(result: AssessmentResult) -> bool:
    if not math.isfinite(result.overall_risk_score):
        return False

    if len(result.parameter_flags) != 3:
        return False

    flag_groups = {flag.group for flag in result.parameter_flags}
    if flag_groups != {"structural", "climate", "lighting"}:
        return False

    if result.ml_model_used and result.model_version is None:
        return False

    return True


def check_confidence_threshold(result: AssessmentResult) -> AssessmentResult:
    min_group_confidence = min(flag.confidence for flag in result.parameter_flags)

    if min_group_confidence < CONFIDENCE_THRESHOLD and result.confidence != Confidence.LOW:
        return result.model_copy(update={"confidence": Confidence.LOW})

    return result


def cross_check_with_rules(
    result: AssessmentResult,
    sensor_data: SensorData,
    building_context: BuildingContext,
) -> AssessmentResult:
    if not result.ml_model_used:
        return result

    rules_result = assess_with_rules(sensor_data, building_context)

    model_severity = STATUS_RANK[result.overall_status]
    rules_severity = STATUS_RANK[rules_result.overall_status]
    severity_gap = abs(model_severity - rules_severity)

    if severity_gap == 0:
        return result

    log_event(
        "model_rules_disagreement",
        model_status=result.overall_status.value,
        rules_status=rules_result.overall_status.value,
        severity_gap=severity_gap,
        model_version=result.model_version,
        sensor_data=sensor_data.model_dump(),
        building_context=building_context.model_dump(),
    )

    if severity_gap >= CRITICAL_CONFLICT_SEVERITY_GAP:
        return result.model_copy(update={"confidence": Confidence.LOW})

    if result.confidence == Confidence.HIGH:
        return result.model_copy(update={"confidence": Confidence.MEDIUM})

    return result


def get_assessment(
    sensor_data: SensorData,
    building_context: BuildingContext,
    models: ModelBundle,
) -> AssessmentResult:
    try:
        result = predict(sensor_data, building_context, models)
    except Exception as exc:  # noqa: BLE001
        log_event(
            "model_inference_failed",
            error=str(exc),
            error_type=type(exc).__name__,
        )
        result = assess_with_rules(sensor_data, building_context)

    if not validate_schema(result):
        log_event(
            "assessment_schema_invalid",
            ml_model_used=result.ml_model_used,
            model_version=result.model_version,
        )
        if result.ml_model_used:
            result = assess_with_rules(sensor_data, building_context)

    result = cross_check_with_rules(result, sensor_data, building_context)
    result = check_confidence_threshold(result)

    return result
