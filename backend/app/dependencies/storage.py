"""Object-storage dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.storage.client import ObjectStorageClient, get_object_storage_client


def get_storage() -> ObjectStorageClient:
    """Provide the shared object-storage client."""

    return get_object_storage_client()


ObjectStorageDep = Annotated[ObjectStorageClient, Depends(get_storage)]
