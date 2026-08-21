from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator

# Re-exported so the AI layer can import everything from one place.
from .building_context import BuildingContext  # noqa: F401
from .sensor_data import SensorData  # noqa: F401

class StatusLevel(str, Enum):
    NORMAL = "normal"
    ATTENTION = "attention"
    CRITICAL = "critical"

# Numeric rank for ordering statuses by severity.
# Shared between ai/validation.py and services/solution_service.py.
STATUS_RANK: dict["StatusLevel", int] = {
    StatusLevel.NORMAL: 0,
    StatusLevel.ATTENTION: 1,
    StatusLevel.CRITICAL: 2,
}

# Alias used by the AI layer (inference.py, validation.py, solution_service.py).
Status = StatusLevel

class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

# Alias used by the AI layer.
Confidence = ConfidenceLevel

class ParameterGroup(str, Enum):
    STRUCTURAL = "structural"
    CLIMATE = "climate"
    LIGHTING = "lighting"

class ParameterFlag(BaseModel):
    group: ParameterGroup
    status: StatusLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    contributing_sensors: list[str] = Field(..., min_length=1)

class AssessmentResult(BaseModel):
    overall_risk_score: float = Field(..., ge=0, le=100)
    overall_status: StatusLevel
    confidence: ConfidenceLevel
    ml_model_used: bool
    # None when ml_model_used=False (rule-based fallback path).
    # The invariant "if ml_model_used then model_version is set" is
    # enforced by validate_schema() in ai/validation.py.
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