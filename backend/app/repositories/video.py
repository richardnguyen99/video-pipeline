"""Video data-access repository."""

from typing import Any, cast

from sqlalchemy.orm import QueryableAttribute, selectinload
from sqlmodel import col, func, select

from app.models.video import Video
from app.repositories.base import BaseRepository


def _relationship_attr(attribute: Any) -> QueryableAttribute[Any]:
    """Narrow a SQLModel relationship to a ``QueryableAttribute`` for mypy."""

    return cast(QueryableAttribute[Any], attribute)


class VideoRepository(BaseRepository):
    """Read operations for ``Video`` rows."""

    async def list_videos(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Video]:
        """Return a page of videos with related entities loaded.

        Loads many-to-many catalog links and one-to-many media URLs.

        Actress aka/images are omitted on list queries; fetch them via
        actress endpoints when needed.

        Args:
            limit: Maximum rows to return.
            offset: Number of rows to skip.

        Returns:
            Matching ``Video`` instances with relations populated.
        """

        statement = (
            select(Video)
            .options(
                selectinload(_relationship_attr(Video.actresses)),
                selectinload(_relationship_attr(Video.genres)),
                selectinload(_relationship_attr(Video.series)),
                selectinload(_relationship_attr(Video.makers)),
                selectinload(_relationship_attr(Video.labels)),
                selectinload(_relationship_attr(Video.directors)),
                selectinload(_relationship_attr(Video.video_image_url)),
                selectinload(
                    _relationship_attr(Video.video_sample_image_url),
                ),
                selectinload(
                    _relationship_attr(Video.video_sample_movie_url),
                ),
            )
            .order_by(col(Video.id))
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def count_videos(self) -> int:
        """Return the total number of video rows."""

        statement = select(func.count()).select_from(Video)
        result = await self.session.exec(statement)
        total = result.one()

        return int(total)
