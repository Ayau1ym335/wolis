import uuid
from sqlalchemy import String, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
 
 
class Material(Base):
    __tablename__ = "materials_reference"
    __table_args__ = (
        UniqueConstraint("name", name="uq_material_name"),
    )
 
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    solution_links: Mapped[list["SolutionMaterial"]] = relationship(
        back_populates="material"
    )
 