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
from jwt import PyJWKClient
from jwt.exceptions import ExpiredSignatureError, PyJWTError as PyJWTInvalidTokenError

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
    Verifies Supabase JWTs.

    Supabase recently started issuing ES256/RS256-signed JWTs for logged in users
    for better security. It still uses HS256 for the anon_key.
    This client supports both by dynamically using the JWKS endpoint for asymmetric
    algorithms and the symmetric JWT secret for HS256.
    """

    _ALGORITHMS = ["HS256", "HS384", "HS512", "RS256", "ES256"]
    # Supabase tokens use "authenticated" as the audience for logged-in users.
    _AUDIENCE = "authenticated"

    def __init__(self, supabase_url: str, jwt_secret: str, anon_key: str = "") -> None:
        self._jwt_secret = jwt_secret
        # Correct Supabase JWKS endpoint — requires apikey header
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        # Supabase requires the anon key as apikey header to access JWKS endpoint.
        jwks_headers = {"apikey": anon_key} if anon_key else {}
        self._jwks_client = PyJWKClient(jwks_url, headers=jwks_headers)

    def verify_token(self, token: str) -> AuthenticatedUser:
        """
        Validates the token signature (either symmetric or asymmetric),
        audience, and expiration. Returns the verified user identity.
        """
        if not token:
            raise InvalidTokenError("Token is empty")

        try:
            # Determine which key to use based on the token header
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg", "HS256")
            
            if alg.startswith("HS"):
                # Symmetric algorithms use the raw project secret string
                signing_key = self._jwt_secret
            else:
                # Asymmetric algorithms (ES256, RS256) require fetching the public key via JWKS
                signing_key = self._jwks_client.get_signing_key_from_jwt(token).key

            payload = jwt.decode(
                token,
                signing_key,
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
        except Exception as exc:
            # Catch other potential errors (like PyJWKClientError if JWKS fetch fails)
            raise InvalidTokenError(f"Failed to verify token key: {exc}") from exc

        user_id = payload.get("sub")
        if not user_id:
            raise InvalidTokenError("Token is missing 'sub' claim")

        return AuthenticatedUser(user_id=user_id, email=payload.get("email"))


@lru_cache(maxsize=1)
def get_auth_client() -> AuthClient:
    """
    Cached factory — AuthClient is stateless except for JWKS cache,
    so a single instance per process is optimal.
    """
    settings = get_settings()
    return AuthClient(
        supabase_url=settings.supabase_url,
        jwt_secret=settings.supabase_jwt_secret,
        anon_key=settings.supabase_anon_key or settings.supabase_service_key,
    )
