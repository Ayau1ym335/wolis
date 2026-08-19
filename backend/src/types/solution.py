from __future__ import annotations
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field

class SolutionType(str, Enum):
    LOW_COST = "low_cost"
    OPTIMAL = "optimal"
    ECO = "eco"


class MaterialItem(BaseModel):
    name: str = Field(..., min_length=1)
    quantity: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    unit_price: float = Field(..., ge=0)


class Money(BaseModel):
    amount: float = Field(..., ge=0)
    currency: Literal["KZT", "USD"]


class Solution(BaseModel):
    type: SolutionType
    required_changes: list[str] = Field(..., min_length=1)
    recommended_materials: list[MaterialItem] = Field(default_factory=list)
    estimated_cost: Money
    estimated_savings_money: Money
    estimated_savings_resources_description: str