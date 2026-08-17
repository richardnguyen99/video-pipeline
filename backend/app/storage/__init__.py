"""Object-storage helpers (S3-compatible / MinIO)."""

from app.storage.client import ObjectStorageClient, get_object_storage_client

__all__ = [
    "ObjectStorageClient",
    "get_object_storage_client",
]
