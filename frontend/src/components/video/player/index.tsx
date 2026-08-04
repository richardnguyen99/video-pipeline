import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/libs/utils";

import { formatPlayerTime } from "./format-time";
import { useHlsPlayer } from "./use-hls-player";

/** Public demo HLS stream (Mux test / Big Buck Bunny). */
export const DEMO_HLS_SRC = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const SEEK_STEP = 10;

interface VideoPlayerProps {
  src?: string;
  poster?: string;
  title?: string;
  className?: string;
}

export function VideoPlayer({ src = DEMO_HLS_SRC, poster, title, className }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
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
    togglePlay,
    seek,
    seekBy,
    setVolume,
    toggleMute,
    setQuality,
  } = useHlsPlayer({ src });

  const scheduleHideControls = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [isPlaying]);

  useEffect(() => {
    scheduleHideControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, scheduleHideControls]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function handleToggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * (duration || 0));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
      case "j":
        e.preventDefault();
        seekBy(-SEEK_STEP);
        break;
      case "ArrowRight":
      case "l":
        e.preventDefault();
        seekBy(SEEK_STEP);
        break;
      case "m":
        e.preventDefault();
        toggleMute();
        break;
      case "f":
        e.preventDefault();
        handleToggleFullscreen();
        break;
      default:
        break;
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const activeQuality = currentQuality >= 0 ? qualities.find((q) => q.index === currentQuality) : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-2xl bg-background outline-none ring-1 ring-border",
        className,
      )}
      tabIndex={0}
      onMouseMove={scheduleHideControls}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={title ? `Video player: ${title}` : "Video player"}
    >
      <video
        ref={videoRef}
        className="size-full bg-background object-contain"
        poster={poster}
        playsInline
        onClick={togglePlay}
      />

      {isLoading && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
          <div className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 px-4 text-center">
          <p className="text-sm font-medium text-foreground">Unable to play stream</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-linear-to-t from-background via-background/70 to-transparent px-3 pt-12 pb-3 transition-opacity duration-200",
          showControls || !isPlaying ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          className="group/progress relative mb-3 h-1.5 cursor-pointer rounded-full bg-muted/60"
          onClick={handleProgressClick}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30"
            style={{ width: `${bufferedPct}%` }}
          />
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/progress:opacity-100 group-hover/progress:bg-primary-active"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-1 text-foreground">
          <ControlButton label={isPlaying ? "Pause" : "Play"} onClick={togglePlay}>
            {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </ControlButton>

          <ControlButton label={`Back ${SEEK_STEP}s`} onClick={() => seekBy(-SEEK_STEP)}>
            <RotateCcw className="size-4" />
          </ControlButton>

          <ControlButton label={`Forward ${SEEK_STEP}s`} onClick={() => seekBy(SEEK_STEP)}>
            <RotateCw className="size-4" />
          </ControlButton>

          {/* Mobile: volume opens vertical slider above the icon */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted/40 hover:text-foreground"
                    aria-label="Volume"
                  />
                }
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="size-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="center"
                sideOffset={8}
                className="flex h-24 w-9 min-w-0 items-center justify-center overflow-hidden p-2"
              >
                <div
                  className="h-24 py-2 flex justify-center"
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Slider
                    orientation="vertical"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[isMuted ? 0 : volume]}
                    onValueChange={(next) => {
                      const v = Array.isArray(next) ? next[0] : next;
                      setVolume(typeof v === "number" ? v : 0);
                    }}
                    aria-label="Volume"
                    className="[&>div]:min-h-20"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop: mute + horizontal slider */}
          <div className="hidden items-center gap-2 sm:flex">
            <ControlButton label={isMuted || volume === 0 ? "Unmute" : "Mute"} onClick={toggleMute}>
              {isMuted || volume === 0 ? (
                <VolumeX className="size-5" />
              ) : volume < 0.5 ? (
                <Volume1 className="size-5" />
              ) : (
                <Volume2 className="size-5" />
              )}
            </ControlButton>
            <div className="w-20 lg:w-28">
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[isMuted ? 0 : volume]}
                onValueChange={(next) => {
                  const v = Array.isArray(next) ? next[0] : next;
                  setVolume(typeof v === "number" ? v : 0);
                }}
                aria-label="Volume"
              />
            </div>
          </div>

          <span className="ml-2 hidden text-xs tabular-nums text-muted-foreground sm:inline">
            {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {qualities.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-foreground hover:bg-muted/40 hover:text-foreground"
                    />
                  }
                >
                  {activeQuality?.label ?? "Auto"}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="min-w-28">
                  <DropdownMenuGroup>
                    <DropdownMenuItem className="gap-2 text-xs" onClick={() => setQuality(-1)}>
                      Auto
                      {currentQuality === -1 ? <Check className="ml-auto size-3.5 shrink-0 text-primary" /> : null}
                    </DropdownMenuItem>
                    {qualities.map((q) => (
                      <DropdownMenuItem key={q.index} className="gap-2 text-xs" onClick={() => setQuality(q.index)}>
                        {q.label}
                        {currentQuality === q.index ? (
                          <Check className="ml-auto size-3.5 shrink-0 text-primary" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <ControlButton label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={handleToggleFullscreen}>
              {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted/40 hover:text-foreground"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
