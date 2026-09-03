from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator

from .building_context import BuildingContext  # noqa: F401
from .sensor_data import SensorData  # noqa: F401


class StatusLevel(str, Enum):
    NORMAL = "normal"
    ATTENTION = "attention"
    CRITICAL = "critical"

STATUS_RANK: dict["StatusLevel", int] = {
    StatusLevel.NORMAL: 0,
    StatusLevel.ATTENTION: 1,
    StatusLevel.CRITICAL: 2,
}

Status = StatusLevel

class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

Confidence = ConfidenceLevel

class ParameterGroup(str, Enum):
    STRUCTURAL = "structural"
    CLIMATE = "climate"
    LIGHTING = "lighting"

class FeatureWeight(BaseModel):
    """Weight of a specific sensor feature in the group's decision."""
    sensor: str
    weight: float = Field(..., ge=0.0, le=1.0)
    label: str = ""  # human-readable label, e.g. "Угол наклона"

class ParameterFlag(BaseModel):
    group: ParameterGroup
    status: StatusLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    contributing_sensors: list[str] = Field(..., min_length=1)
    feature_weights: list[FeatureWeight] = Field(default_factory=list)
    """Top sensor feature importances for this group (from ML model or rule-based)."""
    threshold_description: str = ""
    """Per-instance explanation: e.g. 'Наклон 3.2° > нормы 0.9° для данного здания'."""


class AssessmentResult(BaseModel):
    overall_risk_score: float = Field(..., ge=0, le=100)
    overall_status: StatusLevel
    confidence: ConfidenceLevel
    ml_model_used: bool
    model_version: str | None = None
    parameter_flags: list[ParameterFlag] = Field(..., min_length=1)
    key_concerns: list[str] = Field(default_factory=list)

    @field_validator("parameter_flags")
    @classmethod
    def validate_parameter_flags_length(
        cls, value: list[ParameterFlag]
    ) -> list[ParameterFlag]:
        if len(value) != 3:
            raise ValueError(
                f"parameter_flags must contain exactly 3 elements, got {len(value)}"
            )
        return value

    @model_validator(mode="after")
    def validate_parameter_flags_cover_all_groups(self) -> "AssessmentResult":
        groups = [flag.group for flag in self.parameter_flags]

        if len(groups) != len(set(groups)):
            raise ValueError(
                f"parameter_flags contains duplicate ParameterGroup entries: {groups}"
            )

        missing = set(ParameterGroup) - set(groups)
        if missing:
            missing_names = sorted(group.value for group in missing)
            raise ValueError(
                f"parameter_flags is missing entries for groups: {missing_names}"
            )
        return self