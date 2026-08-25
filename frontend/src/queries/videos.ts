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
};

function toSearchParams(params: VideoListQueryParams) {
  const limit = params.limit ?? VIDEO_DISCOVER_PAGE_SIZE;
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * limit;
  const features = params.features_cnt != null ? stringifyFeaturesCnt(params.features_cnt) : undefined;

  return {
    limit,
    offset,
    sort: params.sort ?? DEFAULT_VIDEO_SORT,
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

export async function fetchVideoById(videoId: string | number) {
  return apiFetch<Video>(`/videos/${videoId}`);
}

export function videoListQueryOptions(params: VideoListQueryParams) {
  return queryOptions({
    queryKey: videoQueryKeys.list(params),
    queryFn: () => fetchVideoList(params),
  });
}

export function videoDetailQueryOptions(videoId: string | number) {
  return queryOptions({
    queryKey: videoQueryKeys.detail(videoId),
    queryFn: () => fetchVideoById(videoId),
  });
}
