from __future__ import annotations
import math
from pydantic import BaseModel, Field, field_validator
VIBRATION_MAGNITUDE_MAX_G = 16.0

def _validate_physical_range(value: float, name: str, low: float, high: float) -> float:
    """Check that `value` is a finite number within [low, high]."""
    if math.isnan(value) or math.isinf(value):
        raise ValueError(f"{name} is not a finite number: {value}")
    if not (low <= value <= high):
        raise ValueError(f"{name} out of physical range: {value}")
    return value


class SensorData(BaseModel):
    temperature_c: float = Field(...)
    humidity_pct: float = Field(..., ge=0, le=100)
    pressure_hpa: float = Field(...)
    illuminance_lux: float = Field(..., ge=0)
    tilt_angle_deg: float = Field(...)
    vibration_magnitude: float = Field(...)
    shock_detected: bool = Field(...)

    @field_validator("temperature_c")
    @classmethod
    def validate_temperature_c(cls, value: float) -> float:
        return _validate_physical_range(value, "temperature_c", -40, 80)

    @field_validator("pressure_hpa")
    @classmethod
    def validate_pressure_hpa(cls, value: float) -> float:
        return _validate_physical_range(value, "pressure_hpa", 300, 1100)

    @field_validator("illuminance_lux")
    @classmethod
    def validate_illuminance_lux(cls, value: float) -> float:
        return _validate_physical_range(value, "illuminance_lux", 0, 100_000)

    @field_validator("tilt_angle_deg")
    @classmethod
    def validate_tilt_angle_deg(cls, value: float) -> float:
        return _validate_physical_range(value, "tilt_angle_deg", 0, 90)

    @field_validator("vibration_magnitude")
    @classmethod
    def validate_vibration_magnitude(cls, value: float) -> float:
        return _validate_physical_range(value, "vibration_magnitude", 0, VIBRATION_MAGNITUDE_MAX_G)
