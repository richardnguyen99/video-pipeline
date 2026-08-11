import type { NamedEntity, Video } from "@/mocks/videos";
import { mockVideos } from "@/mocks/videos";

export type VideoSort = "trending-week" | "trending-month" | "trending-all" | "latest" | "views" | "likes";

/** Actress feature-count range. `max` omitted means open-ended (N or more). */
export type FeaturesCountRange = {
  min: number;
  max?: number;
};

export interface VideoDiscoverFilters {
  actresses: number[];
  genres: number[];
  maker?: number;
  label?: number;
  director?: number;
  series?: number;
  features_cnt?: FeaturesCountRange;
}

export const DEFAULT_VIDEO_SORT: VideoSort = "trending-week";

export const DEFAULT_VIDEO_FILTERS: VideoDiscoverFilters = {
  actresses: [],
  genres: [],
};

export const VIDEO_SORT_OPTIONS: {
  value: VideoSort;
  label: string;
  group?: string;
}[] = [
  { value: "trending-week", label: "This week", group: "Trending" },
  { value: "trending-month", label: "This month", group: "Trending" },
  { value: "trending-all", label: "All time", group: "Trending" },
  { value: "latest", label: "Latest" },
  { value: "views", label: "Most viewed" },
  { value: "likes", label: "Most liked" },
];

/**
 * URL search shape (FastAPI-compatible keys).
 * - `actress` / `genre`: repeated values
 * - `maker` / `label` / `director` / `series`: single int
 * - `features_cnt`: "2" | "3," | "1,3"
 */
export type VideoDiscoverSearchParams = {
  sort?: VideoSort;
  actress?: number[];
  genre?: number[];
  maker?: number;
  label?: number;
  director?: number;
  series?: number;
  features_cnt?: string;
};

export function parseFeaturesCnt(value: unknown): FeaturesCountRange | undefined {
  if (value == null) return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  // "3," → min 3, open max
  if (raw.endsWith(",")) {
    const min = Number(raw.slice(0, -1).trim());
    if (!Number.isFinite(min) || min < 0) return undefined;
    return { min: Math.floor(min) };
  }

  if (raw.includes(",")) {
    const [lo, hi] = raw.split(",", 2).map((s) => s.trim());
    const min = Number(lo);
    const max = Number(hi);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    const a = Math.floor(min);
    const b = Math.floor(max);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  const exact = Number(raw);
  if (!Number.isFinite(exact) || exact < 0) return undefined;
  const n = Math.floor(exact);
  return { min: n, max: n };
}

export function stringifyFeaturesCnt(range: FeaturesCountRange): string {
  if (range.max == null) return `${range.min},`;
  if (range.min === range.max) return String(range.min);
  return `${range.min},${range.max}`;
}

export function buildVideoDiscoverSearch(input: {
  sort?: VideoSort;
  filters?: VideoDiscoverFilters;
}): VideoDiscoverSearchParams {
  const filters = input.filters ?? DEFAULT_VIDEO_FILTERS;
  const search: VideoDiscoverSearchParams = {};

  const sort = input.sort ?? DEFAULT_VIDEO_SORT;
  if (sort !== DEFAULT_VIDEO_SORT) search.sort = sort;

  if (filters.actresses.length > 0) search.actress = filters.actresses;
  if (filters.genres.length > 0) search.genre = filters.genres;
  if (filters.maker != null) search.maker = filters.maker;
  if (filters.label != null) search.label = filters.label;
  if (filters.director != null) search.director = filters.director;
  if (filters.series != null) search.series = filters.series;
  if (filters.features_cnt != null) {
    search.features_cnt = stringifyFeaturesCnt(filters.features_cnt);
  }

  return search;
}

export function hasActiveDiscoverFilters(filters: VideoDiscoverFilters): boolean {
  return (
    filters.actresses.length > 0 ||
    filters.genres.length > 0 ||
    filters.maker != null ||
    filters.label != null ||
    filters.director != null ||
    filters.series != null ||
    filters.features_cnt != null
  );
}

function trendingScore(video: Video): number {
  const views = video.views ?? 0;
  const likes = video.likes ?? 0;
  const dislikes = video.dislikes ?? 0;
  return views + likes * 5 - dislikes * 3;
}

function releaseTime(video: Video): number {
  return video.release_date ? Date.parse(video.release_date) : 0;
}

function withinLastDays(video: Video, days: number): boolean {
  const t = releaseTime(video);
  if (!t) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

export function filterDiscoverVideos(videos: Video[], filters: VideoDiscoverFilters): Video[] {
  return videos.filter((video) => {
    if (filters.actresses.length > 0) {
      const ids = (video.actresses ?? []).map((a) => a.id);
      if (!filters.actresses.some((id) => ids.includes(id))) return false;
    }

    if (filters.genres.length > 0) {
      const ids = (video.genres ?? []).map((g) => g.id);
      if (!filters.genres.some((id) => ids.includes(id))) return false;
    }

    if (filters.maker != null && video.maker?.id !== filters.maker) return false;
    if (filters.label != null && video.label?.id !== filters.label) return false;
    if (filters.director != null && video.director?.id !== filters.director) {
      return false;
    }
    if (filters.series != null && video.series?.id !== filters.series) return false;

    if (filters.features_cnt != null) {
      const count = video.actresses?.length ?? 0;
      const { min, max } = filters.features_cnt;
      if (count < min) return false;
      if (max != null && count > max) return false;
    }

    return true;
  });
}

export function sortDiscoverVideos(videos: Video[], sort: VideoSort): Video[] {
  const list = [...videos];

  switch (sort) {
    case "trending-week": {
      const week = list.filter((v) => withinLastDays(v, 7));
      const pool = week.length > 0 ? week : list;
      return pool.sort(
        (a, b) =>
          trendingScore(b) - trendingScore(a) ||
          releaseTime(b) - releaseTime(a) ||
          a.video_id.localeCompare(b.video_id),
      );
    }
    case "trending-month": {
      const month = list.filter((v) => withinLastDays(v, 30));
      const pool = month.length > 0 ? month : list;
      return pool.sort(
        (a, b) =>
          trendingScore(b) - trendingScore(a) ||
          releaseTime(b) - releaseTime(a) ||
          a.video_id.localeCompare(b.video_id),
      );
    }
    case "trending-all":
      return list.sort(
        (a, b) =>
          trendingScore(b) - trendingScore(a) ||
          releaseTime(b) - releaseTime(a) ||
          a.video_id.localeCompare(b.video_id),
      );
    case "latest":
      return list.sort((a, b) => releaseTime(b) - releaseTime(a) || a.video_id.localeCompare(b.video_id));
    case "views":
      return list.sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || a.video_id.localeCompare(b.video_id));
    case "likes":
      return list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || a.video_id.localeCompare(b.video_id));
    default:
      return list;
  }
}

export type VideoDiscoverResult = {
  videos: Video[];
  total: number;
  sort: VideoSort;
  filters: VideoDiscoverFilters;
};

export async function getDiscoverVideos(
  options: {
    sort?: VideoSort;
    filters?: VideoDiscoverFilters;
    videos?: Video[];
  } = {},
): Promise<VideoDiscoverResult> {
  const sort = options.sort ?? DEFAULT_VIDEO_SORT;
  const filters = options.filters ?? DEFAULT_VIDEO_FILTERS;
  const source = options.videos ?? mockVideos;
  const filtered = filterDiscoverVideos(source, filters);
  const sorted = sortDiscoverVideos(filtered, sort);

  return {
    videos: sorted,
    total: sorted.length,
    sort,
    filters,
  };
}

function collectNamed(
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

export function getAvailableDiscoverActresses(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.actresses ?? []);
}

export function getAvailableDiscoverGenres(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.genres ?? []);
}

export function getAvailableDiscoverMakers(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.maker ?? null);
}

export function getAvailableDiscoverLabels(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.label ?? null);
}

export function getAvailableDiscoverDirectors(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.director ?? null);
}

export function getAvailableDiscoverSeries(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.series ?? null);
}
