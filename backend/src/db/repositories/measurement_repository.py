from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.db.models.measurement_session import MeasurementSession
from src.types.building_context import BuildingContext
from src.types.sensor_data import SensorData

class MeasurementRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict) -> uuid.UUID:
        session = MeasurementSession(**data)

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        return session.id

    def get_by_id(
        self,
        session_id: uuid.UUID,
    ) -> MeasurementSession | None:
        stmt = select(MeasurementSession).where(
            MeasurementSession.id == session_id
        )

        return self.db.scalar(stmt)

    def get_by_user(
        self,
        user_id: uuid.UUID,
    ) -> list[MeasurementSession]:
        stmt = (
            select(MeasurementSession)
            .where(MeasurementSession.user_id == user_id)
            .order_by(MeasurementSession.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    @staticmethod
    def to_sensor_data(session: MeasurementSession) -> SensorData:
        return SensorData(
            temperature_c=session.temperature_c,
            humidity_pct=session.humidity_pct,
            pressure_hpa=session.pressure_hpa,
            illuminance_lux=session.illuminance_lux,
            tilt_angle_deg=session.tilt_angle_deg,
            vibration_magnitude=session.vibration_magnitude,
            shock_detected=session.shock_detected,
        )

    @staticmethod
    def to_building_context(session: MeasurementSession) -> BuildingContext:
        return BuildingContext(
            building_type=session.building_type,
            age_years=session.building_age_years,
            material=session.construction_material,
            area_m2=session.building_area_m2,
            region=session.region,
        )
