import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { Video } from "@/mocks/videos";

export type PlayStartResponse = {
  playback_session_id: string;
  video_id: number;
  is_eligible: boolean;
  position_seconds: number;
  total_view_count: number;
  cooldown_seconds: number;
  heartbeat_interval_seconds: number;
  eligible_threshold_seconds: number;
};

export type HeartbeatResponse = {
  playback_session_id: string;
  video_id: number;
  position_seconds: number;
  accepted: boolean;
};

export type VideoWatchProgress = {
  video_id: number;
  position_seconds: number;
  watch_count: number;
  last_watched_at: string | null;
  updated_at: string | null;
};

export async function startVideoPlay(
  videoId: number,
  options?: {
    playback_session_id?: string;
    position_seconds?: number;
  },
): Promise<PlayStartResponse> {
  const data: {
    playback_session_id?: string | null;
    position_seconds?: number;
  } = {
    playback_session_id: options?.playback_session_id ?? null,
  };

  // Only include position when the client intentionally reports a seek.
  // Omitting zero avoids the worker overwriting saved resume progress.
  if (options?.position_seconds != null && Number.isFinite(options.position_seconds) && options.position_seconds > 0) {
    data.position_seconds = options.position_seconds;
  }

  return apiFetch<PlayStartResponse>(`/videos/${videoId}/play`, {
    method: "POST",
    data,
  });
}

export async function sendVideoPlayHeartbeat(
  videoId: number,
  payload: {
    playback_session_id: string;
    position_seconds: number;
    watched_seconds_delta?: number;
  },
): Promise<HeartbeatResponse> {
  return apiFetch<HeartbeatResponse>(`/videos/${videoId}/play/heartbeat`, {
    method: "POST",
    data: payload,
  });
}

export async function fetchVideoWatchProgress(videoId: number): Promise<VideoWatchProgress> {
  return apiFetch<VideoWatchProgress>(`/videos/${videoId}/watch/progress`);
}

export type WatchedVideo = Video & {
  position_seconds: number;
};

export type WatchedVideosPage = {
  items: Array<WatchedVideo>;
  total: number;
  limit: number;
  offset: number;
};

export async function fetchWatchedVideos(options?: { limit?: number; offset?: number }): Promise<WatchedVideosPage> {
  const limit = options?.limit ?? 12;
  const offset = options?.offset ?? 0;

  return apiFetch<WatchedVideosPage>("/videos/watched", {
    searchParams: { limit, offset },
  });
}

export async function removeWatchedVideo(videoId: number): Promise<void> {
  await apiFetch<void>(`/videos/watched/${videoId}`, {
    method: "DELETE",
  });
}

export const watchedVideoQueryKeys = {
  all: ["videos", "watched"] as const,
  list: (limit: number, offset: number) => [...watchedVideoQueryKeys.all, { limit, offset }] as const,
};

export function watchedVideosQueryOptions(options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 12;
  const offset = options?.offset ?? 0;

  return queryOptions({
    queryKey: watchedVideoQueryKeys.list(limit, offset),
    queryFn: () => fetchWatchedVideos({ limit, offset }),
    staleTime: 30_000,
  });
}
