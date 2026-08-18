from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from db.models.measurement_session import MeasurementSession


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