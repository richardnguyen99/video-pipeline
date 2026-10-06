"""Request and response schemas for video like / dislike reactions."""

from pydantic import BaseModel, Field


class VideoReactionRequest(BaseModel):
    """Body for setting a like or dislike on a video."""

    is_like: bool = Field(
        description="True for like, False for dislike.",
    )


class VideoReactionResponse(BaseModel):
    """Current reaction state for a video after a write or lookup."""

    video_id: int = Field(ge=1)
    is_like: bool | None = Field(
        default=None,
        description="True like, False dislike, null when none.",
    )
    likes: int = Field(default=0, ge=0)
    dislikes: int = Field(default=0, ge=0)
