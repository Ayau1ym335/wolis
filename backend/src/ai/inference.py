import json
import os
from dataclasses import dataclass
from typing import Any
import joblib
from src.ai.model.preprocessing import encode_features, load_encoder
from src.types.assessment import (
    AssessmentResult,
    BuildingContext,
    Confidence,
    ParameterFlag,
    SensorData,
    Status,
)
_DEFAULT_ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
GROUP_CONTRIBUTING_SENSORS = {
    "structural": ["tilt_angle_deg", "vibration_magnitude", "shock_detected"],
    "climate": ["humidity_pct", "temperature_c", "pressure_hpa"],
    "lighting": ["illuminance_lux"],
}

RISK_SCORE_WEIGHTS = {"structural": 0.5, "climate": 0.3, "lighting": 0.2}
CONFIDENCE_THRESHOLD = 0.5


@dataclass
class ModelBundle:
    structural_model: Any
    climate_model: Any
    lighting_model: Any
    encoder: Any
    model_version: str


def load_models(artifacts_dir: str = _DEFAULT_ARTIFACTS_DIR) -> ModelBundle:
    with open(os.path.join(artifacts_dir, "metadata.json")) as f:
        metadata = json.load(f)

    return ModelBundle(
        structural_model=joblib.load(os.path.join(artifacts_dir, "structural_model.pkl")),
        climate_model=joblib.load(os.path.join(artifacts_dir, "climate_model.pkl")),
        lighting_model=joblib.load(os.path.join(artifacts_dir, "lighting_model.pkl")),
        encoder=load_encoder(os.path.join(artifacts_dir, "feature_encoder.pkl")),
        model_version=metadata["model_version"],
    )


def _predict_group(model, encoded_X) -> tuple[Status, float]:
    proba = model.predict_proba(encoded_X)[0]
    class_labels = model.classes_
    top_idx = proba.argmax()
    predicted_status = Status(class_labels[top_idx])
    confidence = float(proba[top_idx])
    return predicted_status, confidence


def _critical_probability(model, encoded_X) -> float:
    proba = model.predict_proba(encoded_X)[0]
    class_labels = list(model.classes_)
    if Status.CRITICAL.value not in class_labels:
        return 0.0
    return float(proba[class_labels.index(Status.CRITICAL.value)])


def _compute_overall_risk_score(critical_probs: dict[str, float]) -> float:
    weighted_sum = sum(
        RISK_SCORE_WEIGHTS[group] * critical_probs[group] for group in RISK_SCORE_WEIGHTS
    )
    return round(weighted_sum * 100.0, 1)


def _compute_overall_status(group_statuses: dict[str, Status]) -> Status:
    structural = group_statuses["structural"]
    climate = group_statuses["climate"]
    lighting = group_statuses["lighting"]

    if structural == Status.CRITICAL:
        return Status.CRITICAL
    if climate == Status.CRITICAL:
        return Status.CRITICAL
    if structural == Status.ATTENTION or climate == Status.ATTENTION or lighting != Status.NORMAL:
        return Status.ATTENTION
    return Status.NORMAL


def _derive_key_concerns(group_statuses: dict[str, Status], sensor_data: SensorData) -> list[str]:
    concerns: list[str] = []

    if group_statuses["structural"] != Status.NORMAL:
        if sensor_data.tilt_angle_deg >= 2.0:
            concerns.append("high_tilt")
        if sensor_data.vibration_magnitude >= 0.15:
            concerns.append("structural_vibration")
        if sensor_data.shock_detected:
            concerns.append("shock_event_detected")

    if group_statuses["climate"] != Status.NORMAL:
        if sensor_data.humidity_pct >= 60.0:
            concerns.append("moisture_risk")
        if not (-15.0 <= sensor_data.temperature_c <= 40.0):
            concerns.append("extreme_temperature")
        if not (950.0 <= sensor_data.pressure_hpa <= 1050.0):
            concerns.append("extreme_pressure")

    if group_statuses["lighting"] != Status.NORMAL:
        concerns.append("insufficient_natural_light")

    return concerns


def predict(
    sensor_data: SensorData,
    building_context: BuildingContext,
    models: ModelBundle,
) -> AssessmentResult:
    encoded_X = encode_features(sensor_data, building_context, models.encoder)

    group_models = {
        "structural": models.structural_model,
        "climate": models.climate_model,
        "lighting": models.lighting_model,
    }

    group_statuses: dict[str, Status] = {}
    group_confidences: dict[str, float] = {}
    critical_probs: dict[str, float] = {}

    for group, model in group_models.items():
        status, confidence = _predict_group(model, encoded_X)
        group_statuses[group] = status
        group_confidences[group] = confidence
        critical_probs[group] = _critical_probability(model, encoded_X)

    overall_risk_score = _compute_overall_risk_score(critical_probs)
    overall_status = _compute_overall_status(group_statuses)

    min_confidence = min(group_confidences.values())
    if min_confidence >= 0.75:
        overall_confidence = Confidence.HIGH
    elif min_confidence >= CONFIDENCE_THRESHOLD:
        overall_confidence = Confidence.MEDIUM
    else:
        overall_confidence = Confidence.LOW

    parameter_flags = [
        ParameterFlag(
            group=group,
            status=group_statuses[group],
            confidence=round(group_confidences[group], 3),
            contributing_sensors=GROUP_CONTRIBUTING_SENSORS[group],
        )
        for group in ("structural", "climate", "lighting")
    ]

    key_concerns = _derive_key_concerns(group_statuses, sensor_data)

    return AssessmentResult(
        overall_risk_score=overall_risk_score,
        overall_status=overall_status,
        confidence=overall_confidence,
        ml_model_used=True,
        model_version=models.model_version,
        parameter_flags=parameter_flags,
        key_concerns=key_concerns,
    )
