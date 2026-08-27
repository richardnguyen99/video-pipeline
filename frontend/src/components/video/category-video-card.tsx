import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, MessageCircle, ThumbsUp } from "lucide-react";

import type { Video } from "@/mocks/videos";
import { cn, formatCompactNumber } from "@/libs/utils";

const REVIEW_MAX_SECONDS = 30;
const HOVER_DELAY_MS = 550;

function getThumbnail(video: Video): string {
  const images = video.video_image_url ?? [];
  const largeImages = images.filter((item) => typeof item.type === "string" && item.type.toLowerCase() === "large");
  const candidates =
    largeImages.length > 0 ? [...largeImages].sort((a, b) => a.id - b.id) : [...images].sort((a, b) => a.id - b.id);
  const preferred = candidates.at(0);

  if (preferred !== undefined && preferred.url !== "") {
    return preferred.url;
  }

  if (video.image_urls?.[0]) {
    return video.image_urls[0];
  }

  return "https://placehold.co/1280x720?text=No+Thumbnail";
}

function getCode(video: Video): string {
  return video.video_id;
}

function getSampleMovieUrl(video: Video): string | undefined {
  return video.sample_movie_url?.[0]?.url;
}

interface CategoryVideoCardProps {
  video: Video;
  className?: string;
  variant?: "carousel" | "grid";
}

export function CategoryVideoCard({ video, className, variant = "carousel" }: CategoryVideoCardProps) {
  const code = getCode(video);
  const poster = getThumbnail(video);
  const sampleUrl = getSampleMovieUrl(video);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isReviewActive, setIsReviewActive] = useState(false);

  const views = video.views ?? 0;
  const likes = video.likes ?? 0;
  const comments = video.comments ?? 0;

  function pauseAndResetVideo(el: HTMLVideoElement | null) {
    if (!el) {
      return;
    }

    el.pause();
    el.currentTime = 0;
  }

  function handleMouseEnter() {
    setIsHovering(true);
  }

  function handleMouseLeave() {
    setIsHovering(false);
    setIsReviewActive(false);
    pauseAndResetVideo(videoRef.current);
  }

  useEffect(() => {
    if (!isHovering || !sampleUrl) {
      return;
    }

    const videoEl = videoRef.current;

    const delayId = window.setTimeout(() => {
      const el = videoRef.current;

      if (!el) {
        return;
      }

      el.currentTime = 0;
      void el
        .play()
        .then(() => setIsReviewActive(true))
        .catch(() => setIsReviewActive(false));
    }, HOVER_DELAY_MS);

    return () => {
      window.clearTimeout(delayId);
      pauseAndResetVideo(videoEl);
    };
  }, [isHovering, sampleUrl]);

  useEffect(() => {
    if (!isReviewActive) {
      return;
    }

    const videoEl = videoRef.current;

    if (!videoEl) {
      return;
    }

    const stopId = window.setTimeout(() => {
      videoEl.pause();
      setIsReviewActive(false);
    }, REVIEW_MAX_SECONDS * 1000);

    return () => {
      window.clearTimeout(stopId);
    };
  }, [isReviewActive]);

  const showReview = isReviewActive && isHovering;

  return (
    <Link
      to="/videos/$id"
      params={{ id: String(video.id) }}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-border bg-card",
        "shadow-[0_0_0_1px_oklch(0.5_0.14_350/12%),0_8px_24px_-12px_oklch(0_0_0/45%)]",
        "transition-all hover:border-primary/50 hover:shadow-[0_0_35px_-12px_var(--color-primary)]",
        variant === "carousel" && "w-64 shrink-0 snap-start sm:w-80",
        variant === "grid" && "w-full",
        className,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={poster}
          alt={code}
          loading="lazy"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            showReview ? "opacity-0" : "opacity-100",
          )}
        />
        {sampleUrl ? (
          <video
            ref={videoRef}
            src={sampleUrl}
            muted
            loop
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-300",
              showReview ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h4 className="line-clamp-2 text-sm font-semibold tracking-tight sm:text-base">{code}</h4>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5 shrink-0" aria-hidden />
              {formatCompactNumber(views)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
              {formatCompactNumber(likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5 shrink-0" aria-hidden />
              {formatCompactNumber(comments)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
