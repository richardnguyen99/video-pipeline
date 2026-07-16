"""Re-exports for backward compatibility. Models have been split into separate modules."""

from app.models.actress import (
    Actress,
    ActressAka,
    ActressImage,
    ActressScrape,
    ActressScrapeErrorPage,
)
from app.models.associations import (
    t_video_actress,
    t_video_director,
    t_video_genre,
    t_video_label,
    t_video_maker,
    t_video_series,
)
from app.models.director import Director, DirectorAka
from app.models.genre import Genre, GenreAka
from app.models.label import Label, LabelAka
from app.models.maker import Maker, MakerAka
from app.models.series import Series, SeriesAka
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

__all__ = [
    "Actress",
    "ActressAka",
    "ActressImage",
    "ActressScrape",
    "ActressScrapeErrorPage",
    "Director",
    "DirectorAka",
    "Genre",
    "GenreAka",
    "Label",
    "LabelAka",
    "Maker",
    "MakerAka",
    "NonDmmVideoPrefix",
    "Series",
    "SeriesAka",
    "Video",
    "VideoAka",
    "VideoAlias",
    "VideoAliasBlacklist",
    "VideoCacheAlias",
    "VideoImageUrl",
    "VideoLastScrapeTimestamp",
    "VideoM3u8",
    "VideoSampleImageUrl",
    "VideoSampleMovieUrl",
    "VideoScrape",
    "t_video_actress",
    "t_video_director",
    "t_video_genre",
    "t_video_label",
    "t_video_maker",
    "t_video_series",
]
