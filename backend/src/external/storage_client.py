from __future__ import annotations
import httpx
from src.config.settings import get_settings

class StorageError(Exception):
    #idk
    pass

class StorageClient:
    def __init__(self, supabase_url: str, service_key: str, bucket: str) -> None:
        self._base = supabase_url.rstrip("/")
        self._service_key = service_key
        self._bucket = bucket

    def upload(self, object_path: str, data: bytes, content_type: str = "application/pdf") -> str:
        url = f"{self._base}/storage/v1/object/{self._bucket}/{object_path}"
        headers = {
            "Authorization": f"Bearer {self._service_key}",
            "Content-Type": content_type,
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
    settings = get_settings()
    return StorageClient(
        supabase_url=settings.supabase_url,
        service_key=settings.supabase_service_key,
        bucket=settings.supabase_storage_bucket,
    )
