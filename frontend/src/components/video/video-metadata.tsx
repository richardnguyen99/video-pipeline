import { TooltipProvider } from "@/components/ui/tooltip";
import type { Video } from "@/mocks/videos";

import { VideoToolbarActions } from "./video-toolbar-action";

interface VideoMetadataProps {
  video: Video;
  views?: number;
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return "Unknown date";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function VideoMetadata({ video, views = 124_800 }: VideoMetadataProps) {
  return (
    <TooltipProvider>
      <div className="space-y-3">
        <h1 className="text-xl font-bold leading-tight sm:text-2xl lg:text-3xl">{video.title}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{formatViews(views)}</span> views
            <span className="mx-1.5">·</span>
            {formatRelativeDate(video.release_date)}
          </p>

          <VideoToolbarActions />
        </div>
      </div>
    </TooltipProvider>
  );
}
