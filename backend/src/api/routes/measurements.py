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
from src.services.assessment_service import AssessmentService
from src.services.solution_service import SolutionGenerationService
from src.services.cost_calculation_service import CostCalculationService
from src.db.repositories.assessment_repository import AssessmentRepository
from src.db.repositories.solution_repository import SolutionRepository
from src.db.repositories.measurement_repository import MeasurementRepository
from src.api.dependencies import (
    get_assessment_service,
    get_solution_generation_service,
    get_cost_calculation_service,
    get_solution_repository,
    get_assessment_repository,
    get_measurement_repository,
)

router = APIRouter(prefix="/measurements", tags=["measurements"])

@router.post("/{session_id}/assess", response_model=MeasurementResultResponse)
async def assess_measurement(
    session_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    assessment_service: AssessmentService = Depends(get_assessment_service),
    solution_generation_service: SolutionGenerationService = Depends(get_solution_generation_service),
    cost_calculation_service: CostCalculationService = Depends(get_cost_calculation_service),
    solution_repository: SolutionRepository = Depends(get_solution_repository),
    assessment_repository: AssessmentRepository = Depends(get_assessment_repository),
    measurement_repository: MeasurementRepository = Depends(get_measurement_repository),
    measurement_service: MeasurementService = Depends(get_measurement_service),
) -> MeasurementResultResponse:
    # 1. Evaluate
    assessment_result = assessment_service.assess_measurement(str(session_id))
    assessment = assessment_repository.get_by_session_id(session_id)
    
    # 2. Get building context
    measurement = measurement_repository.get_by_id(session_id)
    building_context = measurement_repository.to_building_context(measurement)

    # 3. Generate solutions
    solution_drafts = solution_generation_service.generate_solutions(assessment_result, building_context)
    
    # 4. Calculate costs
    priced_solutions = cost_calculation_service.calculate_costs(
        solution_drafts=solution_drafts,
        region=building_context.region,
        assessment_key_concerns=assessment_result.key_concerns,
        building_area_m2=building_context.area_m2,
    )

    # 5. Save solutions
    for sol in priced_solutions:
        sol_id = solution_repository.create({
            "assessment_id": assessment.id,
            "type": sol.type.value,
            "required_changes": sol.required_changes,
            "cost_amount": sol.estimated_cost.amount,
            "cost_currency": sol.estimated_cost.currency,
            "savings_money": sol.estimated_savings.money,
            "savings_resources_description": sol.estimated_savings.resources_description,
        })
        for mat in sol.material_line_items:
            solution_repository.add_material(
                solution_id=sol_id,
                material_id=mat.material_id,
                quantity=mat.quantity,
                price=mat.unit_price_at_calculation,
            )
            
    return await measurement_service.get_measurement_result(session_id=session_id, user_id=user_id)


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