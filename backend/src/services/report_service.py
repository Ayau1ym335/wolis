"""
services/report_service.py

TASK 38 — Orchestrates PDF report generation for a measurement session.

Responsibility chain:
  1. Load MeasurementSession + Assessment + Solutions from DB
  2. Build the Jinja2 context dict (human-readable labels, colour tokens)
  3. Call pdf/report_generator.generate_pdf() → bytes
  4. Determine a stable storage path and upload via StorageClient
  5. Persist the Report row (storage_url) in the DB
  6. Return the public download URL

Design decisions:
  - The service does NOT know about HTTP — it raises plain Python
    exceptions; the route handler converts them to HTTPException.
  - Storage path is deterministic: reports/{session_id}.pdf
    → re-generating overwrites the previous file (upsert).
  - All label mappings live here (not in the template) so the
    template stays dumb.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status as http_status

from src.db.repositories.assessment_repository import AssessmentRepository
from src.db.repositories.measurement_repository import MeasurementRepository
from src.db.repositories.solution_repository import SolutionRepository
from src.external.storage_client import StorageClient, StorageError
from src.pdf.report_generator import generate_pdf
from src.types.api_schemas import SolutionResultItem
from src.types.assessment import AssessmentResult

# ─── Label maps ───────────────────────────────────────────────────────────────

_BUILDING_TYPE_LABELS: dict[str, str] = {
    "residential": "Жилой",
    "commercial": "Коммерческий",
    "historical": "Исторический",
    "industrial": "Промышленный",
}

_MATERIAL_LABELS: dict[str, str] = {
    "brick": "Кирпич",
    "concrete": "Бетон",
    "wood": "Дерево",
    "mixed": "Смешанный",
}

_REGION_LABELS: dict[str, str] = {
    "temperate": "Умеренный",
    "continental": "Континентальный",
    "arid": "Засушливый",
    "coastal": "Прибрежный",
}

_STATUS_LABELS: dict[str, str] = {
    "normal": "Норма",
    "attention": "Внимание",
    "critical": "Критично",
}

_CONFIDENCE_LABELS: dict[str, str] = {
    "low": "Низкая",
    "medium": "Средняя",
    "high": "Высокая",
}

_RISK_COLORS: dict[str, str] = {
    "normal": "#2d7d5a",
    "attention": "#c4781a",
    "critical": "#731919",
}


class ReportService:
    def __init__(
        self,
        measurement_repository: MeasurementRepository,
        assessment_repository: AssessmentRepository,
        solution_repository: SolutionRepository,
        storage_client: StorageClient,
    ) -> None:
        self._measurement_repo = measurement_repository
        self._assessment_repo = assessment_repository
        self._solution_repo = solution_repository
        self._storage = storage_client

    async def generate_report(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> str:
        """
        Generate a PDF report for *session_id*, upload to Supabase Storage,
        persist the Report row, and return the public download URL.

        Raises HTTPException(404) if session not found / not owned by user.
        Raises HTTPException(500) on PDF or storage failures.
        """
        # ── 1. Load session ──────────────────────────────────────────────
        session = self._measurement_repo.get_by_id(session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "Session not found."},
            )

        # ── 2. Load assessment ───────────────────────────────────────────
        assessment_row = self._assessment_repo.get_by_session_id(session_id)
        assessment_domain: AssessmentResult | None = None
        overall_status = "normal"

        if assessment_row:
            # parameter_flags and key_concerns may come back as JSON strings
            # from PostgreSQL — deserialise defensively (same as assessment_repository).
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
            overall_status = assessment_row.overall_status

        # ── 3. Load solutions ────────────────────────────────────────────
        solutions: list[SolutionResultItem] = []
        if assessment_row:
            for sw in self._solution_repo.get_by_assessment_id(assessment_row.id):
                line_items = [
                    {
                        "material_name": sm.material.name,
                        "quantity": sm.quantity,
                        "unit": sm.material.unit,
                        "unit_price_at_calculation": sm.unit_price_at_calculation,
                        "is_estimated_price": sm.material.is_estimated_price,
                        "line_cost": sm.quantity * sm.unit_price_at_calculation,
                    }
                    for sm in sw.materials
                ]
                # required_changes may come back as a JSON string from PostgreSQL.
                # Deserialise defensively (same fix as in measurement_service).
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
                        material_line_items=line_items,
                    )
                )

        # ── 4. Build template context ────────────────────────────────────
        generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
        context = {
            "session_id": str(session_id),
            "generated_at": generated_at,
            "user_id": str(user_id),
            "building_type_label": _BUILDING_TYPE_LABELS.get(
                session.building_type, session.building_type
            ),
            "material_label": _MATERIAL_LABELS.get(
                session.construction_material, session.construction_material
            ),
            "building_age_years": session.building_age_years,
            "building_area_m2": session.building_area_m2,
            "region_label": _REGION_LABELS.get(session.region, session.region),
            "status": session.status,
            "risk_color": _RISK_COLORS.get(overall_status, "#2d7d5a"),
            "status_label_map": _STATUS_LABELS,
            "confidence_label_map": _CONFIDENCE_LABELS,
            "assessment": assessment_domain,
            "solutions": solutions,
        }

        # ── 5. Generate PDF ──────────────────────────────────────────────
        # WeasyPrint is synchronous and CPU-bound — run in threadpool to
        # avoid blocking the FastAPI event loop.
        try:
            pdf_bytes = await asyncio.to_thread(generate_pdf, context)
        except (ImportError, RuntimeError) as exc:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "pdf_generation_failed", "message": str(exc)},
            ) from exc

        # ── 6. Upload to storage ─────────────────────────────────────────
        object_path = f"reports/{session_id}.pdf"
        try:
            public_url = self._storage.upload(object_path, pdf_bytes)
        except StorageError as exc:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "storage_upload_failed", "message": str(exc)},
            ) from exc

        # ── 7. Persist Report row ────────────────────────────────────────
        self._persist_report_row(session_id=session_id, storage_url=public_url)

        return public_url

    def _persist_report_row(self, session_id: uuid.UUID, storage_url: str) -> None:
        """Upsert a Report row so re-generation updates the URL rather than creating a duplicate."""
        from src.db.models.report import Report
        from sqlalchemy import select

        db = self._measurement_repo.db

        existing = db.scalar(
            select(Report).where(Report.session_id == session_id)
        )
        now_utc = datetime.now(timezone.utc)
        if existing:
            existing.storage_url = storage_url
            existing.generated_at = now_utc
            db.commit()
        else:
            report = Report(session_id=session_id, storage_url=storage_url, generated_at=now_utc)
            db.add(report)
            db.commit()
