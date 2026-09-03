from __future__ import annotations
from datetime import datetime
from typing import Any, Literal
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


class SensorReadings(BaseModel):
    """Raw sensor values stored at measurement time — returned for explainability."""
    temperature_c: float
    humidity_pct: float
    pressure_hpa: float
    illuminance_lux: float
    tilt_angle_deg: float
    vibration_magnitude: float
    shock_detected: bool


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: dict | None = None



class MeasurementHistoryItem(BaseModel):
    session_id: UUID
    building_type: str
    building_age_years: int
    construction_material: str
    building_area_m2: float
    region: str
    status: str
    created_at: datetime
    overall_status: str | None = None  
    overall_risk_score: float | None = None


class MaterialLineItemResponse(BaseModel):
    material_name: str
    quantity: float
    unit: str
    unit_price_at_calculation: float
    is_estimated_price: bool
    line_cost: float
    work_description: str = ""


class SolutionResultItem(BaseModel):
    type: str
    required_changes: list[str]
    estimated_cost_amount: float
    estimated_cost_currency: str
    estimated_savings_money: float
    estimated_savings_resources_description: str
    baseline_cost_amount: float = 0.0
    baseline_cost_currency: str = "USD"
    material_line_items: list[MaterialLineItemResponse] = []


class MeasurementResultResponse(BaseModel):
    measurement: MeasurementHistoryItem
    assessment: AssessmentResult | None = None
    solutions: list[SolutionResultItem] = []
    sensor_readings: SensorReadings | None = None
