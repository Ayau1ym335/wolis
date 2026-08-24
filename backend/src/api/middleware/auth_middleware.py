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
    token = _extract_bearer_token(authorization)
    auth_client: AuthClient = get_auth_client()

    try:
        return auth_client.verify_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_token", "message": str(exc)},
        ) from exc
