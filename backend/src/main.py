from fastapi import FastAPI
from src.api.middleware.error_handler import register_error_handlers
from src.api.routes.auth_check import router as auth_check_router  # dev/smoke-test only
from src.api.routes.measurements import router as measurements_router
from src.db.clients import engine
from src.db.models import Base  # noqa: F401 - imports trigger model registration for create_all

app = FastAPI(title="Wolis API")

register_error_handlers(app)
app.include_router(auth_check_router)
app.include_router(measurements_router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(engine)