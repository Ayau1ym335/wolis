from __future__ import annotations
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.db.models.assessment import Assessment
from src.types.assessment import AssessmentResult

class AssessmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save(self, session_id: uuid.UUID, result: AssessmentResult) -> uuid.UUID:
        data = {
            "session_id": session_id,
            "overall_risk_score": result.overall_risk_score,
            "overall_status": result.overall_status.value,
            "confidence": result.confidence.value,
            "ml_model_used": result.ml_model_used,
            "model_version": result.model_version,
            "parameter_flags": [flag.model_dump(mode="json") for flag in result.parameter_flags],
            "key_concerns": result.key_concerns,
        }
        return self.create(data)

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