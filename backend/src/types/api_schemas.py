from __future__ import annotations
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, field_validator

from .assessment import AssessmentResult
from .building_context import BuildingContext
from .sensor_data import SensorData
from .solution import Solution

SOLUTIONS_COUNT = 3
class MeasurementCreateRequest(BaseModel):
    sensor_data: SensorData
    building_context: BuildingContext

class MeasurementCreateResponse(BaseModel):
    session_id: UUID
    status: Literal["complete", "partial"]
    created_at: datetime

class AssessmentResponse(BaseModel):
    session_id: UUID
    assessment: AssessmentResult
    solutions: list[Solution]

    @field_validator("solutions")
    @classmethod
    def validate_solutions_length(cls, value: list[Solution]) -> list[Solution]:
        if len(value) != SOLUTIONS_COUNT:
            raise ValueError(
                f"solutions must contain exactly 3 elements, "
                f"got {len(value)}"
            )
        return value

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: dict | None = None