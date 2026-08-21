"""
Minimal protected endpoint used to verify the auth dependency works
end-to-end before wiring it into real business routes. Not a
production feature — a smoke-test seam for TASK 35's acceptance
criteria (unauthenticated -> 401, authenticated -> 200).
"""

from fastapi import APIRouter, Depends

from src.api.middleware.auth_middleware import get_current_user
from src.external.auth_client import AuthenticatedUser

router = APIRouter()


@router.get("/auth/whoami")
def whoami(current_user: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return {"user_id": current_user.user_id, "email": current_user.email}
