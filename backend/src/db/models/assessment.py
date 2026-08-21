import uuid
from sqlalchemy import ForeignKey, String, Float, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
 
 
class Assessment(Base, TimestampMixin):
    __tablename__ = "assessments"
 
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("measurement_sessions.id"),
        nullable=False,
        unique=True, 
    )
 
    overall_risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    overall_status: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[str] = mapped_column(String(10), nullable=False)
    ml_model_used: Mapped[bool] = mapped_column(Boolean, nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
 
    parameter_flags: Mapped[dict] = mapped_column(JSON, nullable=False)
    key_concerns: Mapped[list] = mapped_column(JSON, nullable=False)
    session: Mapped["MeasurementSession"] = relationship(back_populates="assessment")
    solutions: Mapped[list["Solution"]] = relationship(back_populates="assessment")