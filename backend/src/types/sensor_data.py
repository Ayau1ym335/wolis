
from __future__ import annotations
import math
from pydantic import BaseModel, Field, field_validator

VIBRATION_MAGNITUDE_MAX_G = 16.0
class SensorData(BaseModel):
    temperature_c: float = Field(...)
    humidity_pct: float = Field(..., ge=0,le=100)
    pressure_hpa: float = Field(...)
    illuminance_lux: float = Field(...,ge=0)
    tilt_angle_deg: float = Field(...)
    vibration_magnitude: float = Field(...)
    shock_detected: bool = Field(...)

    @field_validator("temperature_c")
    @classmethod
    def validate_temperature_c(cls, value: float) -> float:
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"temperature_c is not a finite number: {value}")
        if not (-40 <= value <= 80):
            raise ValueError(f"temperature_c out of physical range: {value}")
        return value
 
    @field_validator("pressure_hpa")
    @classmethod
    def validate_pressure_hpa(cls, value: float) -> float:
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"pressure_hpa is not a finite number: {value}")
        if not (300 <= value <= 1100):
            raise ValueError(f"pressure_hpa out of physical range: {value}")
        return value
 
    @field_validator("illuminance_lux")
    @classmethod
    def validate_illuminance_lux(cls, value: float) -> float:
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"illuminance_lux is not a finite number: {value}")
        if not (0 <= value <= 100_000):
            raise ValueError(f"illuminance_lux out of physical range: {value}")
        return value
 
    @field_validator("tilt_angle_deg")
    @classmethod
    def validate_tilt_angle_deg(cls, value: float) -> float:
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"tilt_angle_deg is not a finite number: {value}")
        if not (0 <= value <= 90):
            raise ValueError(f"tilt_angle_deg out of physical range: {value}")
        return value
 
    @field_validator("vibration_magnitude")
    @classmethod
    def validate_vibration_magnitude(cls, value: float) -> float:
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"vibration_magnitude is not a finite number: {value}")
        if value < 0:
            raise ValueError(f"vibration_magnitude is negative: {value}")
        if value > VIBRATION_MAGNITUDE_MAX_G:
            raise ValueError(f"vibration_magnitude out of physical range: {value}")
        return value
 