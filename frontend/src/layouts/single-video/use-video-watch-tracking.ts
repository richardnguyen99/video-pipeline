import { useCallback, useEffect, useRef, useState } from "react";

import { sendVideoPlayHeartbeat, startVideoPlay } from "@/queries/video-watch";
import { useAuthStore } from "@/stores/auth-store";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;

type UseVideoWatchTrackingOptions = {
  videoId: number | null | undefined;
  isPlaying: boolean;
  currentTime: number;
  seek: (time: number) => void;
};

export type VideoWatchTrackingResult = {
  resumeDialogOpen: boolean;
  resumePositionSeconds: number;
  onResume: () => void;
  onStartOver: () => void;
  onDismissResumeDialog: () => void;
};

/**
 * For authenticated users on ``/videos/$id``:
 * 1. ``POST /play`` once per video visit (cooldown + session id)
 * 2. Heartbeats every ~10s while playing (position + watched delta)
 * 3. When saved ``position_seconds`` > 0, expose a resume dialog choice
 */
export function useVideoWatchTracking({
  videoId,
  isPlaying,
  currentTime,
  seek,
}: UseVideoWatchTrackingOptions): VideoWatchTrackingResult {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const sessionIdRef = useRef<string | null>(null);
  const intervalSecondsRef = useRef(DEFAULT_HEARTBEAT_INTERVAL_MS / 1000);
  const lastHeartbeatAtRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const startedForVideoRef = useRef<number | null>(null);
  const startRequestIdRef = useRef(0);
  const resumePositionRef = useRef(0);

  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resumePositionSeconds, setResumePositionSeconds] = useState(0);
  const [trackedVideoId, setTrackedVideoId] = useState(videoId);

  // Reset resume UI when the route video changes (render-time adjust, not an effect).
  if (videoId !== trackedVideoId) {
    setTrackedVideoId(videoId);
    setResumeDialogOpen(false);
    setResumePositionSeconds(0);
  }

  // Refs are not for rendering; reset them after videoId changes.
  useEffect(() => {
    sessionIdRef.current = null;
    lastHeartbeatAtRef.current = null;
    currentTimeRef.current = 0;
    startedForVideoRef.current = null;
    resumePositionRef.current = 0;
  }, [videoId]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (
      videoId == null ||
      !Number.isFinite(videoId) ||
      videoId < 1 ||
      isRestoring ||
      user == null ||
      accessToken == null ||
      accessToken.length === 0
    ) {
      return;
    }

    if (startedForVideoRef.current === videoId && sessionIdRef.current != null) {
      return;
    }

    startRequestIdRef.current += 1;
    const requestId = startRequestIdRef.current;

    void (async () => {
      try {
        const result = await startVideoPlay(videoId);

        if (requestId !== startRequestIdRef.current) {
          return;
        }

        sessionIdRef.current = result.playback_session_id;
        startedForVideoRef.current = videoId;
        intervalSecondsRef.current = Math.max(5, result.heartbeat_interval_seconds || 10);
        lastHeartbeatAtRef.current = Date.now();

        const saved = result.position_seconds;

        if (Number.isFinite(saved) && saved > 0) {
          resumePositionRef.current = saved;
          setResumePositionSeconds(saved);
          setResumeDialogOpen(true);
        }
      } catch {
        if (requestId !== startRequestIdRef.current) {
          return;
        }

        sessionIdRef.current = null;
        startedForVideoRef.current = null;
      }
    })();

    return () => {
      if (startRequestIdRef.current === requestId) {
        startRequestIdRef.current += 1;
      }
    };
  }, [videoId, user, accessToken, isRestoring]);

  useEffect(() => {
    if (videoId == null || user == null || accessToken == null || sessionIdRef.current == null || !isPlaying) {
      return;
    }

    const intervalMs = intervalSecondsRef.current * 1000;

    const tick = () => {
      const sessionId = sessionIdRef.current;

      if (sessionId == null) {
        return;
      }

      const now = Date.now();
      const lastAt = lastHeartbeatAtRef.current ?? now;
      const deltaSeconds = Math.min(intervalSecondsRef.current * 2, Math.max(0, (now - lastAt) / 1000));
      const position = Math.max(0, currentTimeRef.current);

      lastHeartbeatAtRef.current = now;

      void sendVideoPlayHeartbeat(videoId, {
        playback_session_id: sessionId,
        position_seconds: position,
        watched_seconds_delta: deltaSeconds,
      }).catch(() => undefined);
    };

    const id = window.setInterval(tick, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [videoId, user, accessToken, isPlaying]);

  useEffect(() => {
    return () => {
      const sessionId = sessionIdRef.current;
      const id = startedForVideoRef.current;
      const position = Math.max(0, currentTimeRef.current);

      // Avoid flushing a zero position on leave (resets saved seek).
      if (sessionId == null || id == null || user == null || position <= 0) {
        return;
      }

      void sendVideoPlayHeartbeat(id, {
        playback_session_id: sessionId,
        position_seconds: position,
        watched_seconds_delta: Math.min(intervalSecondsRef.current, 10),
      }).catch(() => undefined);
    };
  }, [user]);

  const onResume = useCallback(() => {
    const target = resumePositionRef.current;

    if (target > 0) {
      seek(target);
    }

    setResumeDialogOpen(false);
  }, [seek]);

  const onStartOver = useCallback(() => {
    seek(0);
    resumePositionRef.current = 0;
    setResumeDialogOpen(false);
  }, [seek]);

  const onDismissResumeDialog = useCallback(() => {
    setResumeDialogOpen(false);
  }, []);

  return {
    resumeDialogOpen,
    resumePositionSeconds,
    onResume,
    onStartOver,
    onDismissResumeDialog,
  };
}
