import type { VideoSort } from "@/libs/discover-videos";
import type { NamedEntity, Video } from "@/mocks/videos";
import { getVideosByActressId } from "@/libs/actresses";

/** 4 rows × 4 columns */
export const ACTRESS_VIDEO_PAGE_SIZE = 16;

export type ActressVideoSort = "latest" | "most-viewed" | "most-liked" | "most-comments" | "title";

export interface ActressVideoFilters {
  labels: number[];
  genres: number[];
  makers: number[];
  series?: number;
}

export const DEFAULT_ACTRESS_VIDEO_SORT: ActressVideoSort = "latest";

export const DEFAULT_ACTRESS_VIDEO_FILTERS: ActressVideoFilters = {
  labels: [],
  genres: [],
  makers: [],
};

export const ACTRESS_VIDEO_SORT_OPTIONS: {
  value: ActressVideoSort;
  label: string;
}[] = [
  { value: "latest", label: "Latest" },
  { value: "most-viewed", label: "Most viewed" },
  { value: "most-liked", label: "Most liked" },
  { value: "most-comments", label: "Most comments" },
  { value: "title", label: "Title A–Z" },
];

export type ActressVideoSearchParams = {
  page?: number;
  sort?: ActressVideoSort;
  labels?: number[];
  genres?: number[];
  makers?: number[];
  series?: number;
};

export function buildActressVideoSearch(input: {
  page?: number;
  sort?: ActressVideoSort;
  filters?: ActressVideoFilters;
}): ActressVideoSearchParams {
  const filters = input.filters ?? DEFAULT_ACTRESS_VIDEO_FILTERS;
  const search: ActressVideoSearchParams = {};

  const page = input.page ?? 1;
  if (page > 1) search.page = page;

  const sort = input.sort ?? DEFAULT_ACTRESS_VIDEO_SORT;
  if (sort !== DEFAULT_ACTRESS_VIDEO_SORT) search.sort = sort;

  if (filters.labels.length > 0) search.labels = filters.labels;
  if (filters.genres.length > 0) search.genres = filters.genres;
  if (filters.makers.length > 0) search.makers = filters.makers;
  if (filters.series != null) search.series = filters.series;

  return search;
}

function collectEntities(
  videos: Video[],
  pick: (video: Video) => NamedEntity | NamedEntity[] | null | undefined,
): NamedEntity[] {
  const map = new Map<number, string>();
  for (const video of videos) {
    const value = pick(video);
    if (!value) continue;
    const list = Array.isArray(value) ? value : [value];
    for (const item of list) {
      map.set(item.id, item.name);
    }
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableVideoLabels(videos: Video[]): NamedEntity[] {
  return collectEntities(videos, (v) => v.label ?? null);
}

export function getAvailableVideoGenres(videos: Video[]): NamedEntity[] {
  return collectEntities(videos, (v) => v.genres ?? []);
}

export function getAvailableVideoMakers(videos: Video[]): NamedEntity[] {
  return collectEntities(videos, (v) => v.maker ?? null);
}

export function filterActressVideos(videos: Video[], filters: ActressVideoFilters): Video[] {
  return videos.filter((video) => {
    if (filters.labels.length > 0) {
      if (!video.label || !filters.labels.includes(video.label.id)) return false;
    }
    if (filters.genres.length > 0) {
      const ids = (video.genres ?? []).map((g) => g.id);
      if (!filters.genres.some((id) => ids.includes(id))) return false;
    }
    if (filters.makers.length > 0) {
      if (!video.maker || !filters.makers.includes(video.maker.id)) return false;
    }
    return true;
  });
}

export function sortActressVideos(videos: Video[], sort: ActressVideoSort): Video[] {
  const list = [...videos];

  switch (sort) {
    case "latest":
      return list.sort((a, b) => {
        const da = a.release_date ? Date.parse(a.release_date) : 0;
        const db = b.release_date ? Date.parse(b.release_date) : 0;
        return db - da || a.video_id.localeCompare(b.video_id);
      });
    case "most-viewed":
      return list.sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || a.video_id.localeCompare(b.video_id));
    case "most-liked":
      return list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || a.video_id.localeCompare(b.video_id));
    case "most-comments":
      return list.sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0) || a.video_id.localeCompare(b.video_id));
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title) || a.video_id.localeCompare(b.video_id));
    default:
      return list;
  }
}

export type ActressVideoPageResult = {
  videos: Video[];
  total: number;
  page: number;
  totalPages: number;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
  allVideos: Video[];
};

export function actressVideoSortToApi(sort: ActressVideoSort): VideoSort {
  switch (sort) {
    case "latest":
      return "latest";
    case "most-viewed":
      return "views";
    case "most-liked":
      return "likes";
    case "most-comments":
      return "likes";
    case "title":
      return "latest";
    default:
      return "latest";
  }
}

export async function getActressVideoPage(
  actressId: number,
  options: {
    page?: number;
    sort?: ActressVideoSort;
    filters?: ActressVideoFilters;
    allVideos?: Video[];
  } = {},
): Promise<ActressVideoPageResult> {
  const { fetchVideoList } = await import("@/queries/videos");
  const sort = options.sort ?? DEFAULT_ACTRESS_VIDEO_SORT;
  const filters = options.filters ?? DEFAULT_ACTRESS_VIDEO_FILTERS;
  const page = Math.max(1, options.page ?? 1);

  const result = await fetchVideoList({
    page,
    limit: ACTRESS_VIDEO_PAGE_SIZE,
    sort: actressVideoSortToApi(sort),
    actress: [actressId],
    genre: filters.genres.length > 0 ? filters.genres : undefined,
    maker: filters.makers.length > 0 ? filters.makers[0] : undefined,
    label: filters.labels.length > 0 ? filters.labels[0] : undefined,
    series: filters.series,
  });

  return {
    videos: result.videos,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    sort,
    filters,
    allVideos: options.allVideos ?? [],
  };
}

export function actressVideoListQueryParams(
  actressId: number,
  options: {
    page?: number;
    sort?: ActressVideoSort;
    filters?: ActressVideoFilters;
  } = {},
) {
  const sort = options.sort ?? DEFAULT_ACTRESS_VIDEO_SORT;
  const filters = options.filters ?? DEFAULT_ACTRESS_VIDEO_FILTERS;
  const page = Math.max(1, options.page ?? 1);

  return {
    page,
    limit: ACTRESS_VIDEO_PAGE_SIZE,
    sort: actressVideoSortToApi(sort),
    actress: [actressId],
    genre: filters.genres.length > 0 ? filters.genres : undefined,
    maker: filters.makers.length > 0 ? filters.makers[0] : undefined,
    label: filters.labels.length > 0 ? filters.labels[0] : undefined,
    series: filters.series,
  };
}
