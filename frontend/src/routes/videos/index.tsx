import { createFileRoute } from "@tanstack/react-router";

import { VideoBrowse } from "@/layouts/video-browse";
import type { VideoDiscoverFilters, VideoDiscoverSearchParams, VideoSort } from "@/libs/discover-videos";
import {
  DEFAULT_VIDEO_SORT,
  getAvailableDiscoverActresses,
  getAvailableDiscoverDirectors,
  getAvailableDiscoverGenres,
  getAvailableDiscoverLabels,
  getAvailableDiscoverMakers,
  getAvailableDiscoverSeries,
  getDiscoverVideos,
  parseFeaturesCnt,
} from "@/libs/discover-videos";

const SORT_VALUES: VideoSort[] = ["trending-week", "trending-month", "trending-all", "latest", "views", "likes"];

function asIdArray(value: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    const list = value
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((n): n is number => Number.isFinite(n));
    return list.length > 0 ? list : undefined;
  }
  if (typeof value === "string" && value.length > 0) {
    const list = value
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    return list.length > 0 ? list : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return [value];
  }
  return undefined;
}

function asOptionalId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asSort(value: unknown): VideoSort | undefined {
  if (typeof value === "string" && SORT_VALUES.includes(value as VideoSort)) {
    return value as VideoSort;
  }
  return undefined;
}

export const Route = createFileRoute("/videos/")({
  component: VideosDiscoverPage,
  validateSearch: (search: Record<string, unknown>): VideoDiscoverSearchParams => {
    const result: VideoDiscoverSearchParams = {};

    const sort = asSort(search.sort);
    if (sort && sort !== DEFAULT_VIDEO_SORT) {
      result.sort = sort;
    }

    const actress = asIdArray(search.actress);
    if (actress) result.actress = actress;

    const genre = asIdArray(search.genre);
    if (genre) result.genre = genre;

    const maker = asOptionalId(search.maker);
    if (maker != null) result.maker = maker;

    const label = asOptionalId(search.label);
    if (label != null) result.label = label;

    const director = asOptionalId(search.director);
    if (director != null) result.director = director;

    const series = asOptionalId(search.series);
    if (series != null) result.series = series;

    if (search.features_cnt != null && String(search.features_cnt).trim() !== "") {
      const parsed = parseFeaturesCnt(search.features_cnt);
      if (parsed) result.features_cnt = String(search.features_cnt).trim();
    }

    return result;
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const filters: VideoDiscoverFilters = {
      actresses: deps.actress ?? [],
      genres: deps.genre ?? [],
      maker: deps.maker,
      label: deps.label,
      director: deps.director,
      series: deps.series,
      features_cnt: parseFeaturesCnt(deps.features_cnt),
    };
    const sort = deps.sort ?? DEFAULT_VIDEO_SORT;

    const page = await getDiscoverVideos({ sort, filters });

    return {
      videos: page.videos,
      total: page.total,
      sort: page.sort,
      filters: page.filters,
      actressOptions: getAvailableDiscoverActresses(),
      genreOptions: getAvailableDiscoverGenres(),
      makerOptions: getAvailableDiscoverMakers(),
      labelOptions: getAvailableDiscoverLabels(),
      directorOptions: getAvailableDiscoverDirectors(),
      seriesOptions: getAvailableDiscoverSeries(),
    };
  },
});

function VideosDiscoverPage() {
  const data = Route.useLoaderData();

  return (
    <VideoBrowse
      title="Videos"
      description="Discover titles across the catalog."
      videos={data.videos}
      total={data.total}
      sort={data.sort}
      filters={data.filters}
      actressOptions={data.actressOptions}
      genreOptions={data.genreOptions}
      makerOptions={data.makerOptions}
      labelOptions={data.labelOptions}
      directorOptions={data.directorOptions}
      seriesOptions={data.seriesOptions}
    />
  );
}
