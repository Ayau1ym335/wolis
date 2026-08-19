from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field, field_validator

class BuildingType(str, Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    HISTORICAL = "historical"
    INDUSTRIAL = "industrial"

class ConstructionMaterial(str, Enum):
    BRICK = "brick"
    CONCRETE = "concrete"
    WOOD = "wood"
    MIXED = "mixed"

class BuildingContext(BaseModel):
    building_type: BuildingType
    age_years: int = Field(..., ge=0, le=500)
    material: ConstructionMaterial
    area_m2: float = Field(..., gt=0, le=100_000)
    region: str

    @field_validator("age_years")
    @classmethod
    def validate_age_years(cls, value: int) -> int:
        if not (0 <= value <= 500):
            raise ValueError(f"age_years out of physical range: {value}")
        return value

    @field_validator("area_m2")
    @classmethod
    def validate_area_m2(cls, value: float) -> float:
        if not (0 < value <= 100_000):
            raise ValueError(f"area_m2 out of physical range: {value}")
        return value