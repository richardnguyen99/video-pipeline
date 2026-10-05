import { useEffect, useRef } from "react";

import { sendVideoPlayHeartbeat, startVideoPlay } from "@/queries/video-watch";
import { useAuthStore } from "@/stores/auth-store";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;

type UseVideoWatchTrackingOptions = {
  videoId: number | null | undefined;
  isPlaying: boolean;
  currentTime: number;
  seek: (time: number) => void;
  hasStarted: boolean;
};

/**
 * For authenticated users on ``/videos/$id``:
 * 1. ``POST /play`` once per video visit (cooldown + session id)
 * 2. Heartbeats every ~10s while playing (position + watched delta)
 * 3. Resume from last ``position_seconds`` when the player has started
 */
export function useVideoWatchTracking({
  videoId,
  isPlaying,
  currentTime,
  seek,
  hasStarted,
}: UseVideoWatchTrackingOptions): void {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const sessionIdRef = useRef<string | null>(null);
  const intervalSecondsRef = useRef(DEFAULT_HEARTBEAT_INTERVAL_MS / 1000);
  const lastHeartbeatAtRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const resumeTargetRef = useRef(0);
  const startedForVideoRef = useRef<number | null>(null);
  const startRequestIdRef = useRef(0);

  useEffect(() => {
    sessionIdRef.current = null;
    lastHeartbeatAtRef.current = null;
    currentTimeRef.current = 0;
    resumeAppliedRef.current = false;
    resumeTargetRef.current = 0;
    startedForVideoRef.current = null;
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
        const result = await startVideoPlay(videoId, {
          position_seconds: 0,
        });

        if (requestId !== startRequestIdRef.current) {
          return;
        }

        sessionIdRef.current = result.playback_session_id;
        startedForVideoRef.current = videoId;
        intervalSecondsRef.current = Math.max(5, result.heartbeat_interval_seconds || 10);
        resumeTargetRef.current = result.position_seconds > 1 ? result.position_seconds : 0;
        lastHeartbeatAtRef.current = Date.now();
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
    if (!hasStarted || resumeAppliedRef.current || resumeTargetRef.current <= 1) {
      return;
    }

    seek(resumeTargetRef.current);
    resumeAppliedRef.current = true;
  }, [hasStarted, seek]);

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

      if (sessionId == null || id == null || user == null) {
        return;
      }

      const position = Math.max(0, currentTimeRef.current);

      void sendVideoPlayHeartbeat(id, {
        playback_session_id: sessionId,
        position_seconds: position,
        watched_seconds_delta: Math.min(intervalSecondsRef.current, 10),
      }).catch(() => undefined);
    };
  }, [user]);
}
