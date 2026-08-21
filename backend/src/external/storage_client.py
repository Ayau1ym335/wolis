"""
external/storage_client.py

TASK 38 — Supabase Storage client.

Sole responsibility: upload a binary blob to a Supabase Storage bucket and
return the public URL of the uploaded object.  Keeps the HTTP surface
(fetch/httpx) out of the service layer so it can be mocked in tests.

Supabase Storage REST API used here:
  POST /storage/v1/object/{bucket}/{path}   → upload (upsert)
  GET  /storage/v1/object/public/{bucket}/{path} → public URL (no auth needed)
"""

from __future__ import annotations

import httpx

from src.config.settings import get_settings


class StorageError(Exception):
    """Raised when an upload to Supabase Storage fails."""


class StorageClient:
    """
    Thin wrapper around Supabase Storage REST API.

    Uses a service-role key so it can write to any bucket without
    the caller needing to pass a user token.
    """

    def __init__(self, supabase_url: str, service_key: str, bucket: str) -> None:
        self._base = supabase_url.rstrip("/")
        self._service_key = service_key
        self._bucket = bucket

    def upload(self, object_path: str, data: bytes, content_type: str = "application/pdf") -> str:
        """
        Upload *data* to *object_path* inside the configured bucket.

        object_path should NOT start with '/'.
        Returns the public URL of the uploaded file.

        Raises StorageError on any HTTP or network failure.
        """
        url = f"{self._base}/storage/v1/object/{self._bucket}/{object_path}"
        headers = {
            "Authorization": f"Bearer {self._service_key}",
            "Content-Type": content_type,
            # Upsert so re-generating a report overwrites the previous file
            "x-upsert": "true",
        }

        try:
            response = httpx.put(url, content=data, headers=headers, timeout=30.0)
        except httpx.RequestError as exc:
            raise StorageError(f"Network error uploading to Supabase Storage: {exc}") from exc

        if not response.is_success:
            raise StorageError(
                f"Supabase Storage upload failed [{response.status_code}]: {response.text}"
            )

        return self._public_url(object_path)

    def _public_url(self, object_path: str) -> str:
        return f"{self._base}/storage/v1/object/public/{self._bucket}/{object_path}"


def get_storage_client() -> StorageClient:
    """Cached-friendly factory — call once per request via FastAPI Depends."""
    settings = get_settings()
    return StorageClient(
        supabase_url=settings.supabase_url,
        service_key=settings.supabase_service_key,
        bucket=settings.supabase_storage_bucket,
    )
