"""User video upload endpoints (presigned multipart to raw-uploads)."""

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import StreamingResponse

from app.dependencies import CurrentUserDep, VideoUploadServiceDep
from app.messaging.transcode_progress import iter_progress_events
from app.schemas.video_upload import (
    VideoMediaResponse,
    VideoUploadCompleteRequest,
    VideoUploadCreateRequest,
    VideoUploadCreateResponse,
    VideoUploadListResponse,
    VideoUploadMetadataUpdateRequest,
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


@router.get(
    "/videos/uploads",
    response_model=VideoUploadListResponse,
    status_code=status.HTTP_200_OK,
    summary="List uploads for the current user",
)
async def list_video_uploads(
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> VideoUploadListResponse:
    """Return the authenticated user's recent uploads."""

    return await service.list_uploads(
        uploader_id=current_user.id,
        limit=limit,
        offset=offset,
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


@router.patch(
    "/videos/uploads/{public_id}/metadata",
    response_model=VideoUploadStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Update catalog metadata and relations for an upload",
)
async def update_video_upload_metadata(
    public_id: UUID,
    payload: VideoUploadMetadataUpdateRequest,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoUploadStatusResponse:
    """Persist title, codes, release date, and catalog relation links."""

    return await service.update_metadata(
        public_id=public_id,
        uploader_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/videos/uploads/{public_id}/renditions/{label}/recover",
    response_model=VideoUploadStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Recover a failed or stuck encode rung",
)
async def recover_video_rendition(
    public_id: UUID,
    label: str,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoUploadStatusResponse:
    """Purge lingering segments for one rung, reset it, and re-queue encode."""

    return await service.recover_rendition(
        public_id=public_id,
        uploader_id=current_user.id,
        label=label,
    )


@router.get(
    "/videos/uploads/{public_id}/events",
    summary="Stream live transcode progress (SSE)",
)
async def stream_video_upload_progress(
    public_id: UUID,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> StreamingResponse:
    """Server-Sent Events of Redis-backed encode progress.

    Auth is the normal Bearer dependency. Prefer this over polling
    ``GET /videos/uploads/{public_id}`` on the Process step.
    """

    # Auth + durable snapshot for the first frame when Redis is cold.
    baseline = await service.get_status(
        public_id=public_id,
        uploader_id=current_user.id,
    )

    async def event_stream() -> AsyncIterator[str]:
        baseline_payload = {
            "status": baseline.status,
            "overall_pct": baseline.overall_progress_pct,
            "message": baseline.error_message or "",
            "updated_at": baseline.updated_at.isoformat(),
            "rungs": [
                {
                    "label": row.label,
                    "width": row.width,
                    "height": row.height,
                    "video_kbps": row.video_kbps,
                    "status": row.status,
                    "progress_pct": row.progress_pct,
                    "segment_count": row.segment_count,
                    "playlist_key": row.playlist_key,
                }
                for row in baseline.renditions
            ],
        }
        yield f"event: progress\ndata: {json.dumps(baseline_payload)}\n\n"

        if baseline.status in {"READY", "FAILED"}:
            return

        try:
            async for snapshot in iter_progress_events(public_id):
                payload = json.dumps(snapshot.to_public_dict())
                yield f"event: progress\ndata: {payload}\n\n"

                if snapshot.status in {"READY", "FAILED"}:
                    return

                await asyncio.sleep(0)
        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/videos/uploads/{public_id}/media",
    response_model=VideoMediaResponse,
    status_code=status.HTTP_200_OK,
    summary="List thumbnails and sample images for an upload",
)
async def list_video_upload_media(
    public_id: UUID,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoMediaResponse:
    """Return existing catalog images for the owned upload."""

    return await service.list_media(
        public_id=public_id,
        uploader_id=current_user.id,
    )


@router.post(
    "/videos/uploads/{public_id}/media/thumbnails",
    response_model=VideoMediaResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload a catalog thumbnail (large / list / small)",
)
async def upload_video_thumbnail(
    public_id: UUID,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
    image_type: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> VideoMediaResponse:
    """Store one thumbnail under ``{public_id}/thumbnails/`` on streams."""

    return await service.upload_thumbnail(
        public_id=public_id,
        uploader_id=current_user.id,
        image_type=image_type,
        upload=file,
    )


@router.delete(
    "/videos/uploads/{public_id}/media/thumbnails/{image_type}",
    response_model=VideoMediaResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a catalog thumbnail by type (large / list / small)",
)
async def delete_video_thumbnail(
    public_id: UUID,
    image_type: str,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoMediaResponse:
    """Remove a catalog thumbnail from object storage and the catalog table."""

    return await service.delete_thumbnail(
        public_id=public_id,
        uploader_id=current_user.id,
        image_type=image_type,
    )


@router.post(
    "/videos/uploads/{public_id}/media/samples",
    response_model=VideoMediaResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload sample review images (sample_l / sample_s)",
)
async def upload_video_samples(
    public_id: UUID,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
    image_type: Annotated[str, Form()],
    files: Annotated[list[UploadFile], File()],
) -> VideoMediaResponse:
    """Store sample images under ``{public_id}/samples/`` on streams."""

    return await service.upload_samples(
        public_id=public_id,
        uploader_id=current_user.id,
        image_type=image_type,
        uploads=files,
    )


@router.delete(
    "/videos/uploads/{public_id}/media/samples/{sample_id}",
    response_model=VideoMediaResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete one sample review image",
)
async def delete_video_sample(
    public_id: UUID,
    sample_id: int,
    current_user: CurrentUserDep,
    service: VideoUploadServiceDep,
) -> VideoMediaResponse:
    """Remove a sample image from object storage and the catalog table."""

    return await service.delete_sample(
        public_id=public_id,
        uploader_id=current_user.id,
        sample_id=sample_id,
    )
