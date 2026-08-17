"""Models package."""

from sqlmodel import SQLModel

# pylint: disable=wrong-import-position

SQLModel.metadata.naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


from app.models import associations  # noqa: F401 — registers junction tables
from app.models.actress import (
    Actress,
    ActressAka,
    ActressImage,
)
from app.models.comments import Comment
from app.models.credentials import UserCredential
from app.models.director import Director, DirectorAka
from app.models.genre import Genre, GenreAka
from app.models.label import Label, LabelAka
from app.models.maker import Maker, MakerAka
from app.models.playlist import (
    Playlist,
    PlaylistShare,
    PlaylistVideo,
    PlaylistVisibility,
)
from app.models.refresh_token import RefreshToken
from app.models.series import Series, SeriesAka
from app.models.user import User
from app.models.user_actress_subscribe import UserActressSubscribe
from app.models.video import (
    Video,
    VideoAka,
    VideoAlias,
    VideoImageUrl,
    VideoM3u8,
    VideoSampleImageUrl,
    VideoSampleMovieUrl,
)
from app.models.video_reaction import VideoReaction
from app.models.video_view import VideoView
