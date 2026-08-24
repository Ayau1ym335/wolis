from __future__ import annotations
from pathlib import Path
from typing import Any
from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates"
_TEMPLATE_NAME = "report_template.html"


def render_html(context: dict[str, Any]) -> str:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template(_TEMPLATE_NAME)
    return template.render(**context)


def generate_pdf(context: dict[str, Any]) -> bytes:
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
