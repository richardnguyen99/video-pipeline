"""User video upload endpoints (presigned multipart to raw-uploads)."""

from uuid import UUID

from fastapi import APIRouter, status

from app.dependencies import CurrentUserDep, VideoUploadServiceDep
from app.schemas.video_upload import (
    VideoUploadCompleteRequest,
    VideoUploadCreateRequest,
    VideoUploadCreateResponse,
    VideoUploadPartsRequest,
    VideoUploadPartsResponse,
    VideoUploadStatusResponse,
)

router = APIRouter()


@router.post(
    "/videos/uploads",
    response_model=VideoUploadCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a video upload (multipart presigned URLs)",
)
async def create_video_upload(
    payload: VideoUploadCreateRequest,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoUploadCreateResponse:
    """Create a video row and return presigned part URLs for raw-uploads."""

    return await service.create_upload(
        uploader_id=current_user.id,
        uploader_role=current_user.role,
        payload=payload,
    )


@router.post(
    "/videos/uploads/{public_id}/parts",
    response_model=VideoUploadPartsResponse,
    status_code=status.HTTP_200_OK,
    summary="Presign additional multipart part URLs",
)
async def presign_video_upload_parts(
    public_id: UUID,
    payload: VideoUploadPartsRequest,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoUploadPartsResponse:
    """Return more presigned URLs for an in-progress multipart upload."""

    return await service.presign_parts(
        public_id=public_id,
        uploader_id=current_user.id,
        multipart_upload_id=payload.multipart_upload_id,
        part_numbers=payload.part_numbers,
    )


@router.post(
    "/videos/uploads/{public_id}/complete",
    response_model=VideoUploadStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete multipart upload",
)
async def complete_video_upload(
    public_id: UUID,
    payload: VideoUploadCompleteRequest,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoUploadStatusResponse:
    """Assemble parts in object storage and mark the video as UPLOADED."""

    return await service.complete_upload(
        public_id=public_id,
        uploader_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/videos/uploads/{public_id}",
    response_model=VideoUploadStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get upload status",
)
async def get_video_upload_status(
    public_id: UUID,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoUploadStatusResponse:
    """Return status for an upload owned by the authenticated user."""

    return await service.get_status(
        public_id=public_id,
        uploader_id=current_user.id,
    )
