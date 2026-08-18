import uuid
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, Float, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class MeasurementSession(Base):
    __tablename__ = "measurement_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    temperature_c: Mapped[float] = mapped_column(Float, nullable=False)
    humidity_pct: Mapped[float] = mapped_column(Float, nullable=False)
    pressure_hpa: Mapped[float] = mapped_column(Float, nullable=False)
    illuminance_lux: Mapped[float] = mapped_column(Float, nullable=False)
    tilt_angle_deg: Mapped[float] = mapped_column(Float, nullable=False)
    vibration_magnitude: Mapped[float] = mapped_column(Float, nullable=False)
    shock_detected: Mapped[bool] = mapped_column(Boolean, nullable=False)

    building_type: Mapped[str] = mapped_column(String(50), nullable=False)
    building_age_years: Mapped[int] = mapped_column(Integer, nullable=False)
    construction_material: Mapped[str] = mapped_column(String(50), nullable=False)
    building_area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="complete")
    assessment: Mapped["Assessment"] = relationship(
        back_populates="session", uselist=False
    )
    reports: Mapped[list["Report"]] = relationship(back_populates="session")