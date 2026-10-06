import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type VideoReactionResponse = {
  video_id: number;
  is_like: boolean | null;
  likes: number;
  dislikes: number;
};

export const videoReactionQueryKeys = {
  all: ["video-reaction"] as const,
  byVideo: (videoId: number) => [...videoReactionQueryKeys.all, videoId] as const,
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

export function videoReactionQueryOptions(videoId: number) {
  return queryOptions({
    queryKey: videoReactionQueryKeys.byVideo(videoId),
    queryFn: () => fetchVideoReaction(videoId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
