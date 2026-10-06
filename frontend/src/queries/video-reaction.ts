import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { Video } from "@/mocks/videos";

export type VideoReactionResponse = {
  video_id: number;
  is_like: boolean | null;
  likes: number;
  dislikes: number;
};

export type LikedVideosPage = {
  items: Array<Video>;
  total: number;
  limit: number;
  offset: number;
};

export const LIKED_PAGE_SIZE = 12;

export const videoReactionQueryKeys = {
  all: ["video-reaction"] as const,
  byVideo: (videoId: number) => [...videoReactionQueryKeys.all, videoId] as const,
  liked: (limit: number, offset: number) => [...videoReactionQueryKeys.all, "liked", { limit, offset }] as const,
  likedInfinite: (limit: number) => [...videoReactionQueryKeys.all, "liked", "infinite", { limit }] as const,
};

export async function fetchVideoReaction(videoId: number): Promise<VideoReactionResponse> {
  return apiFetch<VideoReactionResponse>(`/videos/${videoId}/reaction`);
}

export async function setVideoReaction(videoId: number, isLike: boolean): Promise<VideoReactionResponse> {
  return apiFetch<VideoReactionResponse>(`/videos/${videoId}/reaction`, {
    method: "PUT",
    data: { is_like: isLike },
  });
}

export async function clearVideoReaction(videoId: number): Promise<VideoReactionResponse> {
  return apiFetch<VideoReactionResponse>(`/videos/${videoId}/reaction`, {
    method: "DELETE",
  });
}

export async function fetchLikedVideos(options?: { limit?: number; offset?: number }): Promise<LikedVideosPage> {
  const limit = options?.limit ?? 12;
  const offset = options?.offset ?? 0;

  return apiFetch<LikedVideosPage>("/videos/liked", {
    searchParams: { limit, offset },
  });
}

export function videoReactionQueryOptions(videoId: number) {
  return queryOptions({
    queryKey: videoReactionQueryKeys.byVideo(videoId),
    queryFn: () => fetchVideoReaction(videoId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function likedVideosQueryOptions(options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 12;
  const offset = options?.offset ?? 0;

  return queryOptions({
    queryKey: videoReactionQueryKeys.liked(limit, offset),
    queryFn: () => fetchLikedVideos({ limit, offset }),
    staleTime: 30_000,
  });
}

export function likedVideosInfiniteQueryOptions(options?: { limit?: number }) {
  const limit = options?.limit ?? LIKED_PAGE_SIZE;

  return infiniteQueryOptions({
    queryKey: videoReactionQueryKeys.likedInfinite(limit),
    queryFn: ({ pageParam }) => fetchLikedVideos({ limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length === 0) {
        return undefined;
      }

      if (lastPage.items.length < lastPage.limit) {
        return undefined;
      }

      const nextOffset = lastPage.offset + lastPage.items.length;

      if (typeof lastPage.total === "number" && lastPage.total > 0 && nextOffset >= lastPage.total) {
        return undefined;
      }

      return nextOffset;
    },
    staleTime: 30_000,
  });
}
