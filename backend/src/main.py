from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.middleware.error_handler import register_error_handlers
from src.api.routes.auth_check import router as auth_check_router 
from src.api.routes.measurements import router as measurements_router
from src.api.routes.reports import router as reports_router
from src.db.clients import engine
from src.db.models import Base  # noqa: F401 

app = FastAPI(title="Wolis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(auth_check_router)
app.include_router(measurements_router)
app.include_router(reports_router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(engine)