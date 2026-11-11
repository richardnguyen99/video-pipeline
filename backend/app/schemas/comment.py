"""Request and response schemas for video comments."""

from pydantic import BaseModel, Field

from app.schemas.video import VideoCommentResponse


class CommentCreateRequest(BaseModel):
    """Body for posting a new comment or reply."""

    content: str = Field(min_length=1, max_length=4000)
    parent_id: str | None = Field(
        default=None,
        description="Parent comment id when replying.",
    )


class CommentReactionRequest(BaseModel):
    """Body for setting a like or dislike on a comment."""

    is_like: bool = Field(
        description="True for like, False for dislike.",
    )


class CommentReactionResponse(BaseModel):
    """Current reaction state for a comment after a write or lookup."""

    comment_id: str
    is_like: bool | None = Field(
        default=None,
        description="True like, False dislike, null when none.",
    )
    likes: int = Field(default=0, ge=0)
    dislikes: int = Field(default=0, ge=0)


class CommentDeleteResponse(BaseModel):
    """Soft-delete result for a comment."""

    id: str
    is_deleted: bool = True


class CommentListResponse(BaseModel):
    """Top-level comments for a video (tree)."""

    items: list[VideoCommentResponse] = Field(default_factory=list)
