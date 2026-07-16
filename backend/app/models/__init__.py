"""Models package."""

from app.models import associations  # noqa: F401 — registers junction tables
from app.models.actress import (
    Actress,
    ActressAka,
    ActressImage,
    ActressScrape,
    ActressScrapeErrorPage,
)
from app.models.credentials import UserCredential
from app.models.director import Director, DirectorAka
from app.models.genre import Genre, GenreAka
from app.models.label import Label, LabelAka
from app.models.maker import Maker, MakerAka
from app.models.refresh_token import RefreshToken
from app.models.series import Series, SeriesAka
from app.models.user import User
from app.models.video import (
    NonDmmVideoPrefix,
    Video,
    VideoAka,
    VideoAlias,
    VideoAliasBlacklist,
    VideoCacheAlias,
    VideoImageUrl,
    VideoLastScrapeTimestamp,
    VideoM3u8,
    VideoSampleImageUrl,
    VideoSampleMovieUrl,
    VideoScrape,
)
