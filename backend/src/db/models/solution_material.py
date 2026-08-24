import uuid 
from sqlalchemy import ForeignKey, Float, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
 
class SolutionMaterial(Base):
    __tablename__ = "solution_materials"
    __table_args__ = (
        UniqueConstraint("solution_id", "material_id", name="uq_solution_material"),
    )
 
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    solution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solutions.id"), nullable=False
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("materials_reference.id"), nullable=False
    )
 
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price_at_calculation: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    solution: Mapped["Solution"] = relationship(back_populates="materials")
    material: Mapped["Material"] = relationship(back_populates="solution_links")