from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Status(str, Enum):
    NORMAL = "normal"
    ATTENTION = "attention"
    CRITICAL = "critical"


class Confidence(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class BuildingType(str, Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    HISTORICAL = "historical"
    INDUSTRIAL = "industrial"


class Material(str, Enum):
    BRICK = "brick"
    CONCRETE = "concrete"
    WOOD = "wood"
    MIXED = "mixed"


class Region(str, Enum):
    TEMPERATE = "temperate"
    CONTINENTAL = "continental"
    ARID = "arid"
    COASTAL = "coastal"


class SensorData(BaseModel):
    temperature_c: float = Field(..., ge=-60.0, le=70.0)
    humidity_pct: float = Field(..., ge=0.0, le=100.0)
    pressure_hpa: float = Field(..., ge=800.0, le=1100.0)
    illuminance_lux: float = Field(..., ge=0.0, le=100000.0)
    tilt_angle_deg: float = Field(..., ge=0.0, le=90.0)
    vibration_magnitude: float = Field(..., ge=0.0, le=10.0)
    shock_detected: bool


class BuildingContext(BaseModel):
    building_type: BuildingType
    age_years: int = Field(..., ge=0, le=500)
    material: Material
    area_m2: float = Field(..., gt=0.0, le=200000.0)
    region: Region


class ParameterFlag(BaseModel):
    group: str  # "structural" | "climate" | "lighting"
    status: Status
    confidence: float = Field(..., ge=0.0, le=1.0)
    contributing_sensors: list[str]


class AssessmentResult(BaseModel):
    overall_risk_score: float = Field(..., ge=0.0, le=100.0)
    overall_status: Status
    confidence: Confidence
    ml_model_used: bool
    model_version: Optional[str] = None
    parameter_flags: list[ParameterFlag]
    key_concerns: list[str]
