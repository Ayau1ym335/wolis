import uuid
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, Numeric, DateTime, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
 
 
class Solution(Base):
    __tablename__ = "solutions"
    __table_args__ = (
        UniqueConstraint("assessment_id", "type", name="uq_solution_assessment_type"),
    )
 
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    required_changes: Mapped[list] = mapped_column(JSON, nullable=False)
    cost_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cost_currency: Mapped[str] = mapped_column(String(10), nullable=False)
    savings_money: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    savings_resources_description: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    assessment: Mapped["Assessment"] = relationship(back_populates="solutions")
    materials: Mapped[list["SolutionMaterial"]] = relationship(
        back_populates="solution"
    )
