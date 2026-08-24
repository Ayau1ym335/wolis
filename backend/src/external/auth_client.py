from dataclasses import dataclass
from functools import lru_cache
import jwt
from jwt import PyJWKClient
from jwt.exceptions import ExpiredSignatureError, PyJWTError as PyJWTInvalidTokenError
from src.config.settings import get_settings

class InvalidTokenError(Exception):
    pass

@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None

class AuthClient:
    _ALGORITHMS = ["HS256", "HS384", "HS512", "RS256", "ES256"]
    _AUDIENCE = "authenticated"

    def __init__(self, supabase_url: str, jwt_secret: str, anon_key: str = "") -> None:
        self._jwt_secret = jwt_secret
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        jwks_headers = {"apikey": anon_key} if anon_key else {}
        self._jwks_client = PyJWKClient(jwks_url, headers=jwks_headers)

    def verify_token(self, token: str) -> AuthenticatedUser:
        if not token:
            raise InvalidTokenError("Token is empty")

        try:
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg", "HS256")
            
            if alg.startswith("HS"):
                signing_key = self._jwt_secret
            else:
                signing_key = self._jwks_client.get_signing_key_from_jwt(token).key

            payload = jwt.decode(
                token,
                signing_key,
                algorithms=self._ALGORITHMS,
                audience=self._AUDIENCE,
                leeway=60,
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
            raise InvalidTokenError(f"Failed to verify token key: {exc}") from exc

        user_id = payload.get("sub")
        if not user_id:
            raise InvalidTokenError("Token is missing 'sub' claim")

        return AuthenticatedUser(user_id=user_id, email=payload.get("email"))


@lru_cache(maxsize=1)
def get_auth_client() -> AuthClient:
    settings = get_settings()
    return AuthClient(
        supabase_url=settings.supabase_url,
        jwt_secret=settings.supabase_jwt_secret,
        anon_key=settings.supabase_anon_key or settings.supabase_service_key,
    )
