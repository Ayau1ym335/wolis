from __future__ import annotations
from uuid import UUID
from fastapi import APIRouter, Depends, status
from src.api.dependencies import get_current_user_id, get_measurement_service
from src.services.measurement_service import MeasurementService
from src.types.api_schemas import MeasurementCreateRequest, MeasurementCreateResponse
 
router = APIRouter(prefix="/measurements", tags=["measurements"])


@router.post("", response_model=MeasurementCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_measurement(
    request: MeasurementCreateRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: MeasurementService = Depends(get_measurement_service),
) -> MeasurementCreateResponse:
    return await service.create_measurement(user_id=user_id, request=request)