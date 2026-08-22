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
from src.services.assessment_service import AssessmentService
from src.services.solution_service import SolutionGenerationService
from src.services.cost_calculation_service import CostCalculationService
from src.db.repositories.materials_repository import MaterialsRepository
from src.ai.inference import ModelBundle, load_models

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

_model_bundle = None

def get_model_bundle() -> ModelBundle:
    global _model_bundle
    if _model_bundle is None:
        _model_bundle = load_models()
    return _model_bundle

def get_materials_repository(
    db: Session = Depends(get_db_session)
) -> MaterialsRepository:
    return MaterialsRepository(db=db)

def get_assessment_service(
    measurement_repository: MeasurementRepository = Depends(get_measurement_repository),
    assessment_repository: AssessmentRepository = Depends(get_assessment_repository),
    model_bundle: ModelBundle = Depends(get_model_bundle),
) -> AssessmentService:
    return AssessmentService(
        measurement_repository=measurement_repository,
        assessment_repository=assessment_repository,
        model_bundle=model_bundle,
    )

def get_solution_generation_service() -> SolutionGenerationService:
    return SolutionGenerationService()

def get_cost_calculation_service(
    materials_repository: MaterialsRepository = Depends(get_materials_repository)
) -> CostCalculationService:
    return CostCalculationService(materials_repository=materials_repository)
