import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { Level } from "hls.js";

export interface HlsQuality {
  index: number;
  height: number;
  label: string;
}

interface UseHlsPlayerOptions {
  src: string;
  autoPlay?: boolean;
}

interface UseHlsPlayerResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  buffered: number;
  qualities: HlsQuality[];
  currentQuality: number;
  isLoading: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setQuality: (levelIndex: number) => void;
}

function formatQualityLabel(level: Level): string {
  if (level.height) return `${level.height}p`;
  if (level.bitrate) return `${Math.round(level.bitrate / 1000)}kbps`;
  return "Auto";
}

export function useHlsPlayer({ src, autoPlay = false }: UseHlsPlayerOptions): UseHlsPlayerResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [qualities, setQualities] = useState<HlsQuality[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    setIsLoading(true);
    setError(null);
    setQualities([]);
    setCurrentQuality(-1);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        startLevel: -1,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels: HlsQuality[] = data.levels.map((level, index) => ({
          index,
          height: level.height,
          label: formatQualityLabel(level),
        }));
        levels.sort((a, b) => b.height - a.height);
        setQualities(levels);
        setIsLoading(false);
        if (autoPlay) {
          void video.play().catch(() => undefined);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError(data.details);
          setIsLoading(false);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls?.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      const handleLoaded = () => {
        setIsLoading(false);
        if (autoPlay) void video.play().catch(() => undefined);
      };
      video.addEventListener("loadedmetadata", handleLoaded);
      return () => {
        video.removeEventListener("loadedmetadata", handleLoaded);
      };
    } else {
      setError("HLS is not supported in this browser");
      setIsLoading(false);
    }

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [src, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handlePlay() {
      setIsPlaying(true);
    }
    function handlePause() {
      setIsPlaying(false);
    }
    function handleTimeUpdate() {
      setCurrentTime(video!.currentTime);
      if (video!.buffered.length > 0) {
        setBuffered(video!.buffered.end(video!.buffered.length - 1));
      }
    }
    function handleDurationChange() {
      setDuration(video!.duration || 0);
    }
    function handleVolumeChange() {
      setVolumeState(video!.volume);
      setIsMuted(video!.muted);
    }
    function handleWaiting() {
      setIsLoading(true);
    }
    function handleCanPlay() {
      setIsLoading(false);
    }

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const play = useCallback(() => {
    void videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || time));
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration || video.currentTime + delta));
  }, []);

  const setVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(1, value));
    video.volume = next;
    video.muted = next === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const setQuality = useCallback((levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = levelIndex;
    setCurrentQuality(levelIndex);
  }, []);

  return {
    videoRef,
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    buffered,
    qualities,
    currentQuality,
    isLoading,
    error,
    play,
    pause,
    togglePlay,
    seek,
    seekBy,
    setVolume,
    toggleMute,
    setQuality,
  };
}
