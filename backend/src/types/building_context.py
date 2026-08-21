from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field

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