import { apiFetch } from "@/libs/api-client";

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
