"""Legacy tier-1 watch event model (no longer written in active pipeline)."""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy.sql.functions import now
from sqlmodel import Field, SQLModel


class WatchEvent(SQLModel, table=True):
    """Append-only playback analytics event."""

    __tablename__ = "watch_event"
    __table_args__ = {"schema": "public"}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    playback_session_id: uuid.UUID = Field(index=True)
    user_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="public.user.id",
        index=True,
    )
    video_id: int = Field(foreign_key="public.video.id", index=True)
    event_type: str = Field(max_length=32, index=True)
    position_seconds: float = Field(default=0.0, ge=0)
    is_eligible: bool = Field(default=False)
    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={"server_default": now()},
    )

    @classmethod
    def create(
        cls,
        *,
        playback_session_id: uuid.UUID,
        video_id: int,
        event_type: str,
        position_seconds: float = 0.0,
        user_id: Optional[uuid.UUID] = None,
        is_eligible: bool = False,
    ) -> "WatchEvent":
        """Build a new event row (does not persist it)."""

        return cls(
            playback_session_id=playback_session_id,
            user_id=user_id,
            video_id=video_id,
            event_type=event_type,
            position_seconds=max(0.0, float(position_seconds)),
            is_eligible=is_eligible,
        )
