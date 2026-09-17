import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { FeaturesCountRange, VideoDiscoverFilters, VideoSort } from "@/libs/discover-videos";
import { DEFAULT_VIDEO_SORT, VIDEO_DISCOVER_PAGE_SIZE, stringifyFeaturesCnt } from "@/libs/discover-videos";
import type { Video } from "@/mocks/videos";

export type VideoListApiResponse = {
  items: Video[];
  total: number;
  limit: number;
  offset: number;
};

export type VideoListQueryParams = {
  sort?: VideoSort;
  page?: number;
  limit?: number;
  q?: string;
  locale?: string;
  actress?: number[];
  genre?: number[];
  maker?: number;
  label?: number;
  director?: number;
  series?: number;
  features_cnt?: FeaturesCountRange;
};

export type VideoListPage = {
  videos: Video[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  offset: number;
  sort: VideoSort;
  filters: VideoDiscoverFilters;
  q?: string;
  locale?: string;
};

export const videoQueryKeys = {
  all: ["videos"] as const,
  lists: () => [...videoQueryKeys.all, "list"] as const,
  list: (params: VideoListQueryParams) => [...videoQueryKeys.lists(), params] as const,
  details: () => [...videoQueryKeys.all, "detail"] as const,
  detail: (videoId: string | number) => [...videoQueryKeys.details(), videoId] as const,
  recommendations: (videoId: string | number, limit: number) =>
    [...videoQueryKeys.all, "recommendations", videoId, limit] as const,
};

function toSearchParams(params: VideoListQueryParams) {
  const limit = params.limit ?? VIDEO_DISCOVER_PAGE_SIZE;
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * limit;
  const features = params.features_cnt != null ? stringifyFeaturesCnt(params.features_cnt) : undefined;
  const hasQuery = Boolean(params.q?.trim());
  const sort = params.sort ?? (hasQuery ? undefined : DEFAULT_VIDEO_SORT);

  return {
    limit,
    offset,
    sort,
    q: params.q,
    locale: params.locale,
    actress: params.actress,
    genre: params.genre,
    maker: params.maker,
    label: params.label,
    director: params.director,
    series: params.series,
    features_cnt: features,
  };
}

export async function fetchVideoList(params: VideoListQueryParams): Promise<VideoListPage> {
  const limit = params.limit ?? VIDEO_DISCOVER_PAGE_SIZE;
  const page = Math.max(1, params.page ?? 1);
  const sort = params.sort ?? DEFAULT_VIDEO_SORT;
  const response = await apiFetch<VideoListApiResponse>("/videos", {
    searchParams: toSearchParams(params),
  });

  return {
    videos: response.items,
    total: response.total,
    page,
    totalPages: Math.max(1, Math.ceil(response.total / limit)),
    limit: response.limit,
    offset: response.offset,
    sort,
    filters: {
      actresses: params.actress ?? [],
      genres: params.genre ?? [],
      maker: params.maker,
      label: params.label,
      director: params.director,
      series: params.series,
      features_cnt: params.features_cnt,
    },
    q: params.q,
    locale: params.locale,
  };
}

export const DEFAULT_VIDEO_DETAIL_LOCALE = "en-us";

export async function fetchVideoById(videoId: string | number, locale: string = DEFAULT_VIDEO_DETAIL_LOCALE) {
  return apiFetch<Video>(`/videos/${videoId}`, {
    searchParams: { locale },
  });
}

export function videoListQueryOptions(params: VideoListQueryParams) {
  return queryOptions({
    queryKey: videoQueryKeys.list(params),
    queryFn: () => fetchVideoList(params),
  });
}

export function videoDetailQueryOptions(videoId: string | number, locale: string = DEFAULT_VIDEO_DETAIL_LOCALE) {
  return queryOptions({
    queryKey: [...videoQueryKeys.detail(videoId), locale] as const,
    queryFn: () => fetchVideoById(videoId, locale),
  });
}

export const DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT = 12;

/** Max recommendation rows the API stores / returns (offline job limit). */
export const VIDEO_RECOMMENDATIONS_MAX_LIMIT = 50;

/** At most two sidebar pages (initial + one load-more). */
export const VIDEO_RECOMMENDATIONS_MAX_PAGES = 2;

export const VIDEO_RECOMMENDATIONS_EXPANDED_LIMIT = Math.min(
  DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT * VIDEO_RECOMMENDATIONS_MAX_PAGES,
  VIDEO_RECOMMENDATIONS_MAX_LIMIT,
);

export async function fetchVideoRecommendations(
  videoId: string | number,
  limit: number = DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT,
): Promise<Video[]> {
  const response = await apiFetch<VideoListApiResponse>(`/videos/${videoId}/recommendations`, {
    searchParams: { limit },
  });

  return response.items;
}

export function videoRecommendationsQueryOptions(
  videoId: string | number,
  limit: number = DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT,
) {
  return queryOptions({
    queryKey: videoQueryKeys.recommendations(videoId, limit),
    queryFn: () => fetchVideoRecommendations(videoId, limit),
  });
}
