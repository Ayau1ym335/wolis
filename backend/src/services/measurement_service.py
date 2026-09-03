from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException, status as http_status

from ..db.repositories.measurement_repository import MeasurementRepository
from ..db.repositories.assessment_repository import AssessmentRepository
from ..db.repositories.solution_repository import SolutionRepository
from ..types.api_schemas import (
    MeasurementCreateRequest,
    MeasurementCreateResponse,
    MeasurementHistoryItem,
    MeasurementResultResponse,
    MaterialLineItemResponse,
    SensorReadings,
    SolutionResultItem,
)
from ..types.building_context import BuildingContext
from ..types.sensor_data import SensorData

STATUS_COMPLETE = "complete"
STATUS_PARTIAL = "partial"


class MeasurementService:
    def __init__(
        self,
        measurement_repository: MeasurementRepository,
        assessment_repository: AssessmentRepository | None = None,
        solution_repository: SolutionRepository | None = None,
    ) -> None:
        self._measurement_repository = measurement_repository
        self._assessment_repository = assessment_repository
        self._solution_repository = solution_repository

    async def create_measurement(
        self,
        user_id: uuid.UUID,
        request: MeasurementCreateRequest,
    ) -> MeasurementCreateResponse:
        status = self._determine_status(request.sensor_data)

        data = {
            "user_id": user_id,
            "status": status,
            "temperature_c": request.sensor_data.temperature_c,
            "humidity_pct": request.sensor_data.humidity_pct,
            "pressure_hpa": request.sensor_data.pressure_hpa,
            "illuminance_lux": request.sensor_data.illuminance_lux,
            "tilt_angle_deg": request.sensor_data.tilt_angle_deg,
            "vibration_magnitude": request.sensor_data.vibration_magnitude,
            "shock_detected": request.sensor_data.shock_detected,
            "building_type": request.building_context.building_type,
            "building_age_years": request.building_context.age_years,
            "construction_material": request.building_context.material,
            "building_area_m2": request.building_context.area_m2,
            "region": request.building_context.region,
        }

        session_id = self._measurement_repository.create(data)

        return MeasurementCreateResponse(
            session_id=session_id,
            status=status,
            created_at=datetime.now(timezone.utc),
        )

    async def list_measurements(
        self,
        user_id: uuid.UUID,
    ) -> list[MeasurementHistoryItem]:
        sessions = self._measurement_repository.get_by_user(user_id)
        items: list[MeasurementHistoryItem] = []

        for session in sessions:
            overall_status = None
            overall_risk_score = None

            if self._assessment_repository:
                assessment = self._assessment_repository.get_by_session_id(session.id)
                if assessment:
                    overall_status = assessment.overall_status
                    overall_risk_score = assessment.overall_risk_score

            items.append(
                MeasurementHistoryItem(
                    session_id=session.id,
                    building_type=session.building_type,
                    building_age_years=session.building_age_years,
                    construction_material=session.construction_material,
                    building_area_m2=session.building_area_m2,
                    region=session.region,
                    status=session.status,
                    created_at=session.created_at,
                    overall_status=overall_status,
                    overall_risk_score=overall_risk_score,
                )
            )

        return items

    async def get_measurement_result(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> MeasurementResultResponse:
        session = self._measurement_repository.get_by_id(session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "Session not found."},
            )

        measurement = MeasurementHistoryItem(
            session_id=session.id,
            building_type=session.building_type,
            building_age_years=session.building_age_years,
            construction_material=session.construction_material,
            building_area_m2=session.building_area_m2,
            region=session.region,
            status=session.status,
            created_at=session.created_at,
        )

        assessment_domain = None
        solutions: list[SolutionResultItem] = []

        if self._assessment_repository:
            assessment_row = self._assessment_repository.get_by_session_id(session_id)
            if assessment_row:
                from ..types.assessment import AssessmentResult
                import json
                
                parameter_flags = assessment_row.parameter_flags
                if isinstance(parameter_flags, str):
                    parameter_flags = json.loads(parameter_flags)
                    
                key_concerns = assessment_row.key_concerns
                if isinstance(key_concerns, str):
                    key_concerns = json.loads(key_concerns)

                assessment_domain = AssessmentResult.model_validate({
                    "overall_risk_score": assessment_row.overall_risk_score,
                    "overall_status": assessment_row.overall_status,
                    "confidence": assessment_row.confidence,
                    "ml_model_used": assessment_row.ml_model_used,
                    "model_version": assessment_row.model_version,
                    "parameter_flags": parameter_flags,
                    "key_concerns": key_concerns,
                })
                measurement.overall_status = assessment_row.overall_status
                measurement.overall_risk_score = assessment_row.overall_risk_score

                if self._solution_repository:
                    sol_rows = self._solution_repository.get_by_assessment_id(assessment_row.id)
                    for sw in sol_rows:
                        line_items = [
                            MaterialLineItemResponse(
                                material_name=sm.material.name,
                                quantity=float(sm.quantity),
                                unit=sm.material.unit,
                                unit_price_at_calculation=float(sm.unit_price_at_calculation),
                                is_estimated_price=False,
                                line_cost=float(sm.quantity) * float(sm.unit_price_at_calculation),
                                work_description=getattr(sm, "work_description", "") or "",
                            )
                            for sm in sw.materials
                            if sm.material is not None
                        ]
                        required_changes = sw.solution.required_changes or []
                        if isinstance(required_changes, str):
                            required_changes = json.loads(required_changes)
                        solutions.append(
                            SolutionResultItem(
                                type=sw.solution.type,
                                required_changes=required_changes,
                                estimated_cost_amount=float(sw.solution.cost_amount),
                                estimated_cost_currency=sw.solution.cost_currency,
                                estimated_savings_money=float(sw.solution.savings_money),
                                estimated_savings_resources_description=(
                                    sw.solution.savings_resources_description or ""
                                ),
                                baseline_cost_amount=float(sw.solution.baseline_cost_amount or 0.0),
                                baseline_cost_currency=sw.solution.baseline_cost_currency or "USD",
                                material_line_items=line_items,
                            )
                        )

        # Build sensor readings for explainability
        sensor_readings = SensorReadings(
            temperature_c=session.temperature_c,
            humidity_pct=session.humidity_pct,
            pressure_hpa=session.pressure_hpa,
            illuminance_lux=session.illuminance_lux,
            tilt_angle_deg=session.tilt_angle_deg,
            vibration_magnitude=session.vibration_magnitude,
            shock_detected=session.shock_detected,
        )

        return MeasurementResultResponse(
            measurement=measurement,
            assessment=assessment_domain,
            solutions=solutions,
            sensor_readings=sensor_readings,
        )

    @staticmethod
    def _determine_status(sensor_data: SensorData) -> str:
        return STATUS_COMPLETE