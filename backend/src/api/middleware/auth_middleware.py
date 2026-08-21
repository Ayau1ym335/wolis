"""
Authentication dependency for protected routes.

Implemented as a FastAPI dependency (not a starlette-style middleware)
because that lets individual routes opt in explicitly — e.g. a future
public health-check endpoint stays unauthenticated without special-casing
it in a global middleware. Every protected route simply declares
`current_user: AuthenticatedUser = Depends(get_current_user)`.
"""

from fastapi import Header, HTTPException, status

from src.external.auth_client import (
    AuthClient,
    AuthenticatedUser,
    InvalidTokenError,
    get_auth_client,
)

_AUTH_SCHEME_PREFIX = "Bearer "


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "missing_token", "message": "Authorization header is required"},
        )

    if not authorization.startswith(_AUTH_SCHEME_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_token", "message": "Authorization header must use Bearer scheme"},
        )

    return authorization[len(_AUTH_SCHEME_PREFIX):]


def get_current_user(
    authorization: str | None = Header(default=None),
) -> AuthenticatedUser:
    """
    FastAPI dependency: extracts and verifies the bearer token from
    the Authorization header, returning the authenticated user.

    Raises 401 for any failure case (missing header, malformed header,
    invalid/expired token) — the route handler never has to think
    about auth failure modes, only about what to do with a valid user.
    """
    token = _extract_bearer_token(authorization)
    auth_client: AuthClient = get_auth_client()

    try:
        return auth_client.verify_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_token", "message": str(exc)},
        ) from exc
