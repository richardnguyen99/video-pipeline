import { useCallback, useEffect, useRef, useState } from "react";

import { sendVideoPlayHeartbeat, startVideoPlay } from "@/queries/video-watch";
import { useAuthStore } from "@/stores/auth-store";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const REWATCH_POSITION_SECONDS = 3;

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
 * 1. ``POST /play`` once per playback session (cooldown + session id)
 * 2. Heartbeats every ~10s while playing (position + watched delta)
 * 3. When saved ``position_seconds`` > 0, expose a resume dialog choice
 * 4. Open a new session after cooldown or when the viewer restarts from the start
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
  const resumePromptHandledRef = useRef(false);
  const clearProgressOnNextSessionRef = useRef(false);
  const isEligibleRef = useRef(true);
  const cooldownSecondsRef = useRef(0);
  const eligibleThresholdRef = useRef(30);
  const maxPositionRef = useRef(0);
  const sessionStartedAtRef = useRef(0);
  const renewTimerRef = useRef<number | null>(null);

  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resumePositionSeconds, setResumePositionSeconds] = useState(0);
  const [trackedVideoId, setTrackedVideoId] = useState(videoId);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  if (videoId !== trackedVideoId) {
    setTrackedVideoId(videoId);
    setResumeDialogOpen(false);
    setResumePositionSeconds(0);
  }

  useEffect(() => {
    sessionIdRef.current = null;
    lastHeartbeatAtRef.current = null;
    currentTimeRef.current = 0;
    startedForVideoRef.current = null;
    resumePositionRef.current = 0;
    resumePromptHandledRef.current = false;
    clearProgressOnNextSessionRef.current = false;
    isEligibleRef.current = true;
    maxPositionRef.current = 0;
    sessionStartedAtRef.current = 0;

    if (renewTimerRef.current != null) {
      window.clearTimeout(renewTimerRef.current);
      renewTimerRef.current = null;
    }
  }, [videoId]);

  useEffect(() => {
    currentTimeRef.current = currentTime;

    if (currentTime > maxPositionRef.current) {
      maxPositionRef.current = currentTime;
    }
  }, [currentTime]);

  const clearRenewTimer = useCallback(() => {
    if (renewTimerRef.current != null) {
      window.clearTimeout(renewTimerRef.current);
      renewTimerRef.current = null;
    }
  }, []);

  const scheduleSessionRenewal = useCallback(
    (delaySeconds: number) => {
      clearRenewTimer();

      if (delaySeconds <= 0) {
        return;
      }

      renewTimerRef.current = window.setTimeout(() => {
        sessionIdRef.current = null;
        startedForVideoRef.current = null;
        lastHeartbeatAtRef.current = null;
        maxPositionRef.current = 0;
        setSessionEpoch((value) => value + 1);
      }, delaySeconds * 1000);
    },
    [clearRenewTimer],
  );

  const beginSession = useCallback(
    async (nextVideoId: number, requestId: number) => {
      try {
        const result = await startVideoPlay(nextVideoId);

        if (requestId !== startRequestIdRef.current) {
          return;
        }

        sessionIdRef.current = result.playback_session_id;
        startedForVideoRef.current = nextVideoId;
        intervalSecondsRef.current = Math.max(5, result.heartbeat_interval_seconds || 10);
        lastHeartbeatAtRef.current = Date.now();
        sessionStartedAtRef.current = Date.now();
        isEligibleRef.current = result.is_eligible;
        cooldownSecondsRef.current = Math.max(0, result.cooldown_seconds || 0);
        eligibleThresholdRef.current = Math.max(1, result.eligible_threshold_seconds || 30);
        maxPositionRef.current = Math.max(maxPositionRef.current, currentTimeRef.current);

        if (!result.is_eligible && result.cooldown_seconds > 0) {
          scheduleSessionRenewal(result.cooldown_seconds);
        } else {
          clearRenewTimer();
        }

        if (clearProgressOnNextSessionRef.current) {
          clearProgressOnNextSessionRef.current = false;
          resumePositionRef.current = 0;
          setResumePositionSeconds(0);
          setResumeDialogOpen(false);

          void sendVideoPlayHeartbeat(nextVideoId, {
            playback_session_id: result.playback_session_id,
            position_seconds: 0,
            watched_seconds_delta: 0,
          }).catch(() => undefined);

          return;
        }

        const saved = result.position_seconds;

        if (Number.isFinite(saved) && saved > 0 && resumePositionRef.current === 0 && !resumePromptHandledRef.current) {
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
    },
    [clearRenewTimer, scheduleSessionRenewal],
  );

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

    void beginSession(videoId, requestId);

    return () => {
      if (startRequestIdRef.current === requestId) {
        startRequestIdRef.current += 1;
      }
    };
  }, [videoId, user, accessToken, isRestoring, sessionEpoch, beginSession]);

  // After an eligible watch, restarting near the beginning opens a new session
  // so a rewatch can count once the cooldown window allows it.
  useEffect(() => {
    if (videoId == null || user == null || accessToken == null || sessionIdRef.current == null || !isPlaying) {
      return;
    }

    const watchedDeep = maxPositionRef.current >= Math.max(eligibleThresholdRef.current, REWATCH_POSITION_SECONDS + 1);
    const restartedNearStart = currentTime <= REWATCH_POSITION_SECONDS;
    const sessionAgeMs = Date.now() - sessionStartedAtRef.current;

    if (!watchedDeep || !restartedNearStart || sessionAgeMs < 5_000) {
      return;
    }

    clearRenewTimer();
    sessionIdRef.current = null;
    startedForVideoRef.current = null;
    lastHeartbeatAtRef.current = null;
    maxPositionRef.current = currentTime;
    setSessionEpoch((value) => value + 1);
  }, [videoId, user, accessToken, isPlaying, currentTime, clearRenewTimer]);

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
  }, [videoId, user, accessToken, isPlaying, sessionEpoch]);

  useEffect(() => {
    return () => {
      clearRenewTimer();

      const sessionId = sessionIdRef.current;
      const id = startedForVideoRef.current;
      const position = Math.max(0, currentTimeRef.current);

      if (sessionId == null || id == null || user == null || position <= 0) {
        return;
      }

      void sendVideoPlayHeartbeat(id, {
        playback_session_id: sessionId,
        position_seconds: position,
        watched_seconds_delta: Math.min(intervalSecondsRef.current, 10),
      }).catch(() => undefined);
    };
  }, [user, clearRenewTimer]);

  const onResume = useCallback(() => {
    const target = resumePositionRef.current;

    if (target > 0) {
      seek(target);
    }

    resumePromptHandledRef.current = true;
    setResumeDialogOpen(false);
  }, [seek]);

  const onStartOver = useCallback(() => {
    seek(0);
    resumePositionRef.current = 0;
    resumePromptHandledRef.current = true;
    clearProgressOnNextSessionRef.current = true;
    setResumePositionSeconds(0);
    setResumeDialogOpen(false);
    clearRenewTimer();
    sessionIdRef.current = null;
    startedForVideoRef.current = null;
    lastHeartbeatAtRef.current = null;
    maxPositionRef.current = 0;
    setSessionEpoch((value) => value + 1);
  }, [seek, clearRenewTimer]);

  const onDismissResumeDialog = useCallback(() => {
    resumePromptHandledRef.current = true;
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
