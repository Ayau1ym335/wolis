from __future__ import annotations
import logging
from fastapi import FastAPI
from src.api.middleware.error_handler import register_error_handlers
from src.api.routes.measurements import router as measurements_router
 
logging.basicConfig(level=logging.INFO)
def create_app() -> FastAPI:
    app = FastAPI(title="Wolis API", version="0.1.0")
    register_error_handlers(app)
    app.include_router(measurements_router, prefix="/api/v1")
    return app
 
app = create_app()
