from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, status
from src.api.dependencies import get_current_user_id, get_measurement_service
from src.services.measurement_service import MeasurementService
from src.types.api_schemas import (
    MeasurementCreateRequest,
    MeasurementCreateResponse,
    MeasurementHistoryItem,
    MeasurementResultResponse,
)

router = APIRouter(prefix="/measurements", tags=["measurements"])


@router.post("", response_model=MeasurementCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_measurement(
    request: MeasurementCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: MeasurementService = Depends(get_measurement_service),
) -> MeasurementCreateResponse:
    return await service.create_measurement(user_id=user_id, request=request)


@router.get("", response_model=list[MeasurementHistoryItem])
async def list_measurements(
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: MeasurementService = Depends(get_measurement_service),
) -> list[MeasurementHistoryItem]:
    """Return the authenticated user's measurement sessions, newest first."""
    return await service.list_measurements(user_id=user_id)


@router.get("/{session_id}/result", response_model=MeasurementResultResponse)
async def get_measurement_result(
    session_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: MeasurementService = Depends(get_measurement_service),
) -> MeasurementResultResponse:
    """Return full result (assessment + solutions) for a single session."""
    return await service.get_measurement_result(session_id=session_id, user_id=user_id)