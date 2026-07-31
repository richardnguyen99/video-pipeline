import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, Eye, Flag, ListPlus, MessageCircle, MoreVertical, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Video } from "@/mocks/videos";
import { cn, formatCompactNumber, formatDuration, formatRelativeDate } from "@/libs/utils";

export type VideoCardBadge = "recommended" | "new" | "trending";

export interface VideoSidebarCardProps {
  video: Video;
  views?: number;
  likes?: number;
  comments?: number;
  uploadedAt?: string;
  uploader?: string;
  badge?: VideoCardBadge;
}

const BADGE_LABEL: Record<VideoCardBadge, string> = {
  recommended: "Recommended",
  new: "New",
  trending: "Trending",
};

const PREVIEW_MAX_MS = 30_000;
const PREVIEW_FRAME_MS = 1000;

export function VideoSidebarCard({
  video,
  views = 12_400,
  likes = 820,
  comments = 64,
  uploadedAt,
  uploader,
  badge,
}: VideoSidebarCardProps) {
  const thumbnails = video.sample_image_urls?.length ? video.sample_image_urls : (video.image_urls ?? []);
  const poster = thumbnails[0] ?? video.image_urls?.[0];

  const [isHovering, setIsHovering] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isHovering || thumbnails.length < 2) {
      setFrameIndex(0);
      startedAt.current = null;
      return;
    }

    startedAt.current = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - (startedAt.current ?? Date.now());
      if (elapsed >= PREVIEW_MAX_MS) {
        setFrameIndex(0);
        startedAt.current = Date.now();
      } else {
        setFrameIndex((i) => (i + 1) % thumbnails.length);
      }
    }, PREVIEW_FRAME_MS);

    return () => window.clearInterval(id);
  }, [isHovering, thumbnails.length]);

  const displaySrc = isHovering && thumbnails.length > 0 ? thumbnails[frameIndex % thumbnails.length] : poster;

  const resolvedUploader = uploader ?? video.maker_product ?? video.actresses?.[0]?.name ?? "Unknown";
  const resolvedUploadedAt = uploadedAt ?? video.release_date;
  const resolvedBadge =
    badge ??
    (video.release_date && Date.now() - new Date(video.release_date).getTime() < 1000 * 60 * 60 * 24 * 60
      ? "new"
      : undefined);

  return (
    <article className="group relative">
      <Link
        to="/videos/$video_id"
        params={{ video_id: video.video_id }}
        className={cn(
          "flex gap-3 rounded-xl p-2 outline-none transition-colors",
          "hover:bg-muted/80 focus-visible:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="relative w-[42%] max-w-40 shrink-0 overflow-hidden rounded-lg">
          <div className="relative aspect-video w-full bg-muted">
            {displaySrc ? <img src={displaySrc} alt="" className="size-full object-cover" loading="lazy" /> : null}

            {resolvedBadge ? (
              <span className="absolute bottom-1.5 left-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {BADGE_LABEL[resolvedBadge]}
              </span>
            ) : null}

            <span className="absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
              {formatDuration(video.duration)}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
          <span className="line-clamp-1 text-sm font-medium leading-snug" title={video.video_id}>
            {video.video_id}
          </span>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="line-clamp-1">
              {resolvedUploader}
              <span className="mx-1">·</span>
              {formatRelativeDate(resolvedUploadedAt)}
            </p>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <Eye className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Views:</span>
                {formatCompactNumber(views)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Likes:</span>
                {formatCompactNumber(likes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Comments:</span>
                {formatCompactNumber(comments)}
              </span>
            </p>
          </div>
        </div>
      </Link>

      <div
        className="absolute top-2 right-2 z-10"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "size-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100",
                )}
                aria-label="Video actions"
              />
            }
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2">
                <ListPlus className="size-4" />
                <p>Add to playlist</p>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Ban className="size-4" />
                <p>Remove (blacklist)</p>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Flag className="size-4" />
                <p>Report</p>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
