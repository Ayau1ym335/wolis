from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from db.models.material import Material

class MaterialsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_name(
        self,
        name: str,
        region: str | None,
    ) -> Material | None:
        stmt = select(Material).where(
            Material.name == name,
            Material.region == region,
        )
        return self.db.scalar(stmt)

    def list_all(self) -> list[Material]:
        stmt = select(Material).order_by(Material.name)
        return list(self.db.scalars(stmt).all())