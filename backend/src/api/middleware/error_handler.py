from __future__ import annotations 
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from src.api.exceptions import (
    ExternalServiceError,
    NotFoundError,
    ValidationError,
)
from src.types.api_schemas import ErrorResponse

 
def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ValidationError)
    async def handle_validation_error(request: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=ErrorResponse(
                error_code="VALIDATION_ERROR",
                message=str(exc),
            ).model_dump(),
        )
 
    @app.exception_handler(RequestValidationError)
    async def handle_pydantic_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=ErrorResponse(
                error_code="VALIDATION_ERROR",
                message="Request payload validation failed.",
                details={"errors": exc.errors()},
            ).model_dump(),
        )
 
    @app.exception_handler(NotFoundError)
    async def handle_not_found_error(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=ErrorResponse(
                error_code="NOT_FOUND",
                message=str(exc),
            ).model_dump(),
        )
 
    @app.exception_handler(ExternalServiceError)
    async def handle_external_service_error(
        request: Request, exc: ExternalServiceError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorResponse(
                error_code="EXTERNAL_SERVICE_ERROR",
                message="A dependent service is unavailable. Please try again.",
            ).model_dump(),
        )
 
    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error_code="INTERNAL_ERROR",
                message="Something went wrong. Please try again.",
            ).model_dump(),
        )
 