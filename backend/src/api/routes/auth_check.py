"""
Minimal protected endpoint used to verify the auth dependency works
end-to-end before wiring it into real business routes. Not a
production feature — a smoke-test seam for TASK 35's acceptance
criteria (unauthenticated -> 401, authenticated -> 200).
"""

import os
import jwt as pyjwt
from fastapi import APIRouter, Depends, Header

from src.api.middleware.auth_middleware import get_current_user
from src.external.auth_client import AuthenticatedUser

router = APIRouter()


@router.get("/auth/whoami")
def whoami(current_user: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return {"user_id": current_user.user_id, "email": current_user.email}


@router.get("/health")
def health() -> dict:
    """Public endpoint — shows config state without exposing secret values."""
    jwt_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
    return {
        "status": "ok",
        "jwt_secret_set": bool(jwt_secret),
        "jwt_secret_length": len(jwt_secret),
        "supabase_url_set": bool(os.environ.get("SUPABASE_URL")),
        "database_url_set": bool(os.environ.get("DATABASE_URL")),
    }


@router.get("/auth/debug-token")
def debug_token(authorization: str | None = Header(default=None)) -> dict:
    """
    Decode token WITHOUT verifying signature — shows its raw claims.
    Use this to check what aud/sub/role fields the mobile app is sending.
    Safe because we're not trusting the token, just reading it.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return {"error": "No Bearer token provided"}
    token = authorization[7:]
    try:
        header = pyjwt.get_unverified_header(token)
        payload = pyjwt.decode(token, options={"verify_signature": False})
        # Now try WITH verification to see actual error
        jwt_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
        verify_error = None
        try:
            pyjwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
            verify_ok = True
        except Exception as e:
            verify_ok = False
            verify_error = str(e)
        return {
            "header": header,
            "payload": payload,
            "jwt_secret_length": len(jwt_secret),
            "verify_ok": verify_ok,
            "verify_error": verify_error,
        }
    except Exception as e:
        return {"error": f"Cannot decode token: {e}"}
