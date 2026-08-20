from fastapi import FastAPI
from src.api.middleware.error_handler import register_error_handlers
from src.api.routes.assessments import router as assessments_router
from src.api.routes.measurements import router as measurements_router
from src.db.client import engine
from src.db.models.measurement_session import Base
from src.db.models.assessment import Assessment  # noqa: F401 - must be imported so create_all sees it
from src.db.models.material import MaterialReference  # noqa: F401
from src.db.models.solution import Solution, SolutionMaterial  # noqa: F401

app = FastAPI(title="Wolis API")

register_error_handlers(app)
app.include_router(measurements_router)
app.include_router(assessments_router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(engine)