"""
Application configuration.

Reads all environment-dependent values in one place. Nothing in the
rest of the codebase should call os.environ directly — everything
goes through this module, so there's exactly one place to look when
something is misconfigured.
"""

import os
from functools import lru_cache


class Settings:
    """
    Immutable snapshot of environment configuration.

    Required variables raise at startup (fail fast) rather than
    surfacing as a confusing runtime error deep inside a request.
    """

    def __init__(self) -> None:
        self.supabase_url: str = self._require("SUPABASE_URL")
        self.supabase_jwt_secret: str = self._require("SUPABASE_JWT_SECRET")
        self.supabase_service_key: str = self._require("SUPABASE_SERVICE_KEY")
        self.supabase_anon_key: str = os.environ.get("SUPABASE_ANON_KEY", "")
        self.database_url: str = self._require("DATABASE_URL")
        self.supabase_storage_bucket: str = os.environ.get(
            "SUPABASE_STORAGE_BUCKET", "wolis-reports"
        )
        self.environment: str = os.environ.get("ENVIRONMENT", "development")

    @staticmethod
    def _require(key: str) -> str:
        value = os.environ.get(key)
        if not value:
            raise RuntimeError(
                f"Missing required environment variable: {key}. "
                f"Check your .env file against .env.example."
            )
        return value


@lru_cache
def get_settings() -> Settings:
    """
    Cached settings accessor. Use this everywhere instead of
    instantiating Settings() directly, so env is only read once.
    """
    return Settings()
