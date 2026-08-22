import logging
import json
from typing import Any

logger = logging.getLogger("wolis.ai")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

def log_event(event_name: str, **kwargs: Any) -> None:
    """
    Log an event with optional kwargs.
    """
    try:
        details = json.dumps(kwargs, default=str)
    except Exception:
        details = str(kwargs)
    logger.info(f"EVENT: {event_name} | {details}")
