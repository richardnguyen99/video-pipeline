"""Actress data-access repository."""

from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select

from app.models.actress import Actress, ActressAka, ActressImage
from app.models.associations import t_video_actress
from app.models.user_actress_subscribe import UserActressSubscribe
from app.models.video_view import VideoView
from app.repositories.base import BaseRepository
from app.utils import _col, _relationship_attr


class ActressRepository(BaseRepository):
    """Read operations for ``Actress`` rows."""

    async def list_actresses(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Actress]:
        """Return a page of actresses with aka and images loaded.

        ``selectinload`` avoids cartesian products; ``load_only`` limits
        columns to those exposed by the public schemas.

        Args:
            limit: Maximum rows to return.
            offset: Number of rows to skip.

        Returns:
            Matching ``Actress`` instances with ``actress_aka`` and
            ``actress_image`` populated.
        """

        statement = (
            select(Actress)
            .options(
                selectinload(
                    _relationship_attr(Actress.actress_aka),
                ).load_only(
                    _col(ActressAka.id),
                    _col(ActressAka.name),
                    _col(ActressAka.translated_name),
                ),
                selectinload(
                    _relationship_attr(Actress.actress_image),
                ).load_only(
                    _col(ActressImage.id),
                    _col(ActressImage.url),
                    _col(ActressImage.attribute),
                ),
            )
            .order_by(col(Actress.id))
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def count_actresses(self) -> int:
        """Return the total number of actress rows."""

        statement = select(func.count()).select_from(Actress)
        result = await self.session.exec(statement)
        total = result.one()

        return int(total)

    async def count_engagement_for_actresses(
        self,
        actress_ids: list[int],
    ) -> dict[int, dict[str, int]]:
        """Return video / subscription / view totals for many actresses.

        * ``video_cnt`` — rows in ``video_actress`` for the actress
        * ``sub_cnt`` — rows in ``user_actress_subscribe``
        * ``view_cnt`` — ``video_view`` events on videos featuring the actress

        Missing ids default to zeros.

        Args:
            actress_ids: Primary keys to aggregate.

        Returns:
            Mapping of actress id → count dict.
        """

        totals: dict[int, dict[str, int]] = {
            actress_id: {
                "video_cnt": 0,
                "sub_cnt": 0,
                "view_cnt": 0,
            }
            for actress_id in actress_ids
        }

        if not actress_ids:
            return totals

        video_stmt = (
            sa_select(
                t_video_actress.c.fk_id,
                func.count().label("cnt"),
            )
            .where(t_video_actress.c.fk_id.in_(actress_ids))
            .group_by(t_video_actress.c.fk_id)
        )
        video_result = await self.session.execute(video_stmt)

        for actress_id, cnt in video_result.all():
            totals[int(actress_id)]["video_cnt"] = int(cnt)

        sub_stmt = (
            select(
                col(UserActressSubscribe.actress_id),
                func.count().label("cnt"),
            )
            .where(col(UserActressSubscribe.actress_id).in_(actress_ids))
            .group_by(col(UserActressSubscribe.actress_id))
        )
        sub_result = await self.session.exec(sub_stmt)

        for actress_id, cnt in sub_result.all():
            totals[int(actress_id)]["sub_cnt"] = int(cnt)

        view_stmt = (
            sa_select(
                t_video_actress.c.fk_id,
                func.count().label("cnt"),
            )
            .select_from(t_video_actress)
            .join(
                VideoView,
                col(VideoView.video_id) == t_video_actress.c.video_id,
            )
            .where(t_video_actress.c.fk_id.in_(actress_ids))
            .group_by(t_video_actress.c.fk_id)
        )
        view_result = await self.session.execute(view_stmt)

        for actress_id, cnt in view_result.all():
            totals[int(actress_id)]["view_cnt"] = int(cnt)

        return totals
