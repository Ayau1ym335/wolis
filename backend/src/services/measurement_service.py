from __future__ import annotations
from uuid import UUID
from datetime import datetime, timezone

from ..db.repositories.measurement_repository import MeasurementRepository
from ..types.api_schemas import MeasurementCreateRequest, MeasurementCreateResponse
from ..types.building_context import BuildingContext
from ..types.sensor_data import SensorData

STATUS_COMPLETE = "complete"
STATUS_PARTIAL = "partial"


class MeasurementService:
    def __init__(self, measurement_repository: MeasurementRepository) -> None:
        self._measurement_repository = measurement_repository

    async def create_measurement(
        self,
        user_id: UUID,
        request: MeasurementCreateRequest,
    ) -> MeasurementCreateResponse:
        status = self._determine_status(request.sensor_data)

        data = {
            "user_id": user_id,
            "status": status,
            "temperature_c": request.sensor_data.temperature_c,
            "humidity_pct": request.sensor_data.humidity_pct,
            "pressure_hpa": request.sensor_data.pressure_hpa,
            "illuminance_lux": request.sensor_data.illuminance_lux,
            "tilt_angle_deg": request.sensor_data.tilt_angle_deg,
            "vibration_magnitude": request.sensor_data.vibration_magnitude,
            "shock_detected": request.sensor_data.shock_detected,
            "building_type": request.building_context.building_type,
            "building_age_years": request.building_context.age_years,
            "construction_material": request.building_context.material,
            "building_area_m2": request.building_context.area_m2,
            "region": request.building_context.region,
        }

        session_id = self._measurement_repository.create(data)

        return MeasurementCreateResponse(
            session_id=session_id,
            status=status,
            created_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _determine_status(sensor_data: SensorData) -> str:
        return STATUS_COMPLETE