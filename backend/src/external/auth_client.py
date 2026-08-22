"""
Supabase Auth client.

Sole responsibility: given a raw JWT string, decide whether it is a
valid Supabase-issued token and, if so, extract the identity it
carries. This module knows nothing about HTTP, FastAPI, or routing —
it is a pure verification client, so it can be unit-tested in
isolation and reused from anywhere (middleware, background jobs,
scripts) without dragging in web framework dependencies.
"""

from dataclasses import dataclass
from functools import lru_cache

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError as PyJWTInvalidTokenError

from src.config.settings import get_settings


class InvalidTokenError(Exception):
    """Raised when a token is missing, malformed, expired, or has a bad signature."""


@dataclass(frozen=True)
class AuthenticatedUser:
    """Identity extracted from a verified token. Nothing more than what call sites need."""

    user_id: str
    email: str | None


class AuthClient:
    """
    Verifies Supabase-issued JWTs locally using the project's JWT
    secret, rather than making a network call to Supabase on every
    request. This is the standard approach for Supabase Auth and
    keeps auth checks fast and independent of Supabase uptime.
    """

    # Supabase issues HS256-signed JWTs by default for the project JWT secret.
    # Support multiple algorithms in case Supabase project uses a different one
    _ALGORITHMS = ["HS256", "HS384", "HS512", "RS256"]
    # Supabase tokens use "authenticated" as the audience for logged-in users.
    _AUDIENCE = "authenticated"

    def __init__(self, jwt_secret: str) -> None:
        self._jwt_secret = jwt_secret

    def verify_token(self, token: str) -> AuthenticatedUser:
        """
        Verify a raw JWT string and return the identity it carries.

        Raises InvalidTokenError for any failure case (expired, bad
        signature, missing required claims) — callers don't need to
        distinguish the reason, only that the token isn't usable.
        """
        if not token:
            raise InvalidTokenError("Token is empty")

        try:
            payload = jwt.decode(
                token,
                self._jwt_secret,
                algorithms=self._ALGORITHMS,
                audience=self._AUDIENCE,
                leeway=60,  # Handle clock skew between Supabase and backend
            )
        except ExpiredSignatureError as exc:
            raise InvalidTokenError("Token has expired") from exc
        except PyJWTInvalidTokenError as exc:
            try:
                header = jwt.get_unverified_header(token)
            except Exception:
                header = "unknown"
            raise InvalidTokenError(f"Token signature or claims are invalid: {exc}. Header: {header}") from exc

        user_id = payload.get("sub")
        if not user_id:
            raise InvalidTokenError("Token is missing 'sub' claim")

        return AuthenticatedUser(user_id=user_id, email=payload.get("email"))


@lru_cache(maxsize=1)
def get_auth_client() -> AuthClient:
    """
    Cached factory — AuthClient is stateless and immutable, so a single
    instance shared across all requests is safe and avoids re-reading
    settings on every authentication check.
    """
    settings = get_settings()
    return AuthClient(jwt_secret=settings.supabase_jwt_secret)
