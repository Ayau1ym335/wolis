from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from src.api.dependencies import (
    get_assessment_repository,
    get_current_user_id,
    get_measurement_repository,
    get_solution_repository,
)
from src.db.repositories.assessment_repository import AssessmentRepository
from src.db.repositories.measurement_repository import MeasurementRepository
from src.db.repositories.solution_repository import SolutionRepository
from src.external.storage_client import StorageClient, get_storage_client
from src.services.report_service import ReportService

router = APIRouter(prefix="/measurements", tags=["reports"])
class ReportResponse(BaseModel):
    download_url: str

def get_report_service(
    measurement_repository: MeasurementRepository = Depends(get_measurement_repository),
    assessment_repository: AssessmentRepository = Depends(get_assessment_repository),
    solution_repository: SolutionRepository = Depends(get_solution_repository),
    storage_client: StorageClient = Depends(get_storage_client),
) -> ReportService:
    return ReportService(
        measurement_repository=measurement_repository,
        assessment_repository=assessment_repository,
        solution_repository=solution_repository,
        storage_client=storage_client,
    )


@router.post(
    "/{session_id}/report",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED
)
async def generate_report(
    session_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    report_service: ReportService = Depends(get_report_service),
) -> ReportResponse:
    download_url = await report_service.generate_report(
        session_id=session_id,
        user_id=user_id,
    )
    return ReportResponse(download_url=download_url)
