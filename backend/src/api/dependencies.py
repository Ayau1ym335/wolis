from __future__ import annotations
from uuid import UUID
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.db.repositories.assessment_repository import AssessmentRepository
from src.db.repositories.measurement_repository import MeasurementRepository
from src.db.repositories.solution_repository import SolutionRepository
from src.db.clients import get_session
from src.services.measurement_service import MeasurementService
from src.api.middleware.auth_middleware import get_current_user
from src.external.auth_client import AuthenticatedUser


# get_session from db/clients.py is already a FastAPI-style generator dependency.
get_db_session = get_session


def get_measurement_repository(
    db: Session = Depends(get_db_session)
) -> MeasurementRepository:
    """
    Фабрика репозитория. Реальная реализация подключает Supabase/Postgres
    client (см. db/client.py) — вынесено в отдельную функцию, чтобы в тестах
    можно было переопределить через app.dependency_overrides без импорта
    реального DB-клиента.
    """
    return MeasurementRepository(db=db)


def get_assessment_repository(
    db: Session = Depends(get_db_session)
) -> AssessmentRepository:
    return AssessmentRepository(db=db)


def get_solution_repository(
    db: Session = Depends(get_db_session)
) -> SolutionRepository:
    return SolutionRepository(db=db)


def get_measurement_service(
    measurement_repository: MeasurementRepository = Depends(get_measurement_repository),
    assessment_repository: AssessmentRepository = Depends(get_assessment_repository),
    solution_repository: SolutionRepository = Depends(get_solution_repository),
) -> MeasurementService:
    return MeasurementService(
        measurement_repository=measurement_repository,
        assessment_repository=assessment_repository,
        solution_repository=solution_repository,
    )


def get_current_user_id(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> UUID:
    """
    TASK 35/36: real JWT verification via auth_middleware → auth_client.
    Extracts the user_id UUID from the verified Supabase token.
    Raises 401 automatically if the token is missing or invalid.
    """
    try:
        return UUID(current_user.user_id)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_token", "message": "Token sub claim is not a valid UUID"},
        )