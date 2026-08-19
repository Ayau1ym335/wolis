from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.db.models.assessment import Assessment

class AssessmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict) -> uuid.UUID:
        assessment = Assessment(**data)
        self.db.add(assessment)
        self.db.commit()
        self.db.refresh(assessment)
        return assessment.id

    def get_by_session_id(
        self,
        session_id: uuid.UUID,
    ) -> Assessment | None:
        stmt = select(Assessment).where(
            Assessment.session_id == session_id
        )
        return self.db.scalar(stmt)