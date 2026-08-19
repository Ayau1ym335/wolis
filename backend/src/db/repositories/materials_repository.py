from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.db.models.material import Material

class MaterialsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_name(
        self,
        name: str,
    ) -> Material | None:
        stmt = select(Material).where(
            Material.name == name,
        )
        return self.db.scalar(stmt)

    def list_all(self) -> list[Material]:
        stmt = select(Material).order_by(Material.name)
        return list(self.db.scalars(stmt).all())