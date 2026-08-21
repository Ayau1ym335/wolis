"""
pdf/report_generator.py

TASK 38 — Converts a fully-assembled report context dict into a PDF binary.

Strategy: render Jinja2 HTML template → weasyprint → bytes.

weasyprint is a pure-Python HTML/CSS→PDF engine with no system-level
dependencies beyond Cairo/Pango (available in standard Docker images).
If weasyprint is not installed, the module raises ImportError at call
time (not at import time) so other parts of the app are unaffected.

The generator is a plain function, not a class — it is stateless and
deterministic. Thread-safe: each call creates its own Jinja2 environment
instance and weasyprint document.

Context dict shape (produced by ReportService):
{
    "session_id":                  str,
    "generated_at":                str,    # "21 авг. 2026, 15:41"
    "user_id":                     str,
    "building_type_label":         str,
    "material_label":              str,
    "building_age_years":          int,
    "building_area_m2":            float,
    "region_label":                str,
    "status":                      str,
    "risk_color":                  str,    # CSS colour for the gauge
    "status_label_map":            dict,
    "confidence_label_map":        dict,
    "assessment":                  AssessmentResult | None,
    "solutions":                   list[SolutionResultItem],
}
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

# Template directory is ../../templates relative to this file:
#   backend/src/pdf/report_generator.py
#   backend/templates/report_template.html
_TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates"
_TEMPLATE_NAME = "report_template.html"


def render_html(context: dict[str, Any]) -> str:
    """Render the Jinja2 report template with *context* and return HTML string."""
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template(_TEMPLATE_NAME)
    return template.render(**context)


def generate_pdf(context: dict[str, Any]) -> bytes:
    """
    Render the report template and convert to PDF bytes.

    Raises:
        ImportError  — if weasyprint is not installed.
        RuntimeError — if PDF rendering fails.
    """
    try:
        from weasyprint import HTML  # type: ignore[import]
    except ImportError as exc:
        raise ImportError(
            "weasyprint is required for PDF generation. "
            "Install it with: pip install weasyprint"
        ) from exc

    html_content = render_html(context)

    try:
        pdf_bytes: bytes = HTML(string=html_content, base_url=str(_TEMPLATE_DIR)).write_pdf()
    except Exception as exc:
        raise RuntimeError(f"PDF rendering failed: {exc}") from exc

    return pdf_bytes
