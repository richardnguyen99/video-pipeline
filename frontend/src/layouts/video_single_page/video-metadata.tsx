import { TooltipProvider } from "@/components/ui/tooltip";
import type { Video } from "@/mocks/videos";
import { formatCompactNumber, formatRelativeDate } from "@/libs/utils";
import { VideoToolbarActions } from "@/components/video/video-toolbar-action";

interface VideoMetadataProps {
  video: Video;
  views?: number;
}

export function VideoMetadata({ video, views = 124_800 }: VideoMetadataProps) {
  return (
    <TooltipProvider>
      <div className="space-y-3">
        <h1 className="text-xl font-bold leading-tight sm:text-2xl lg:text-3xl">{video.title}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{formatCompactNumber(views)}</span> views
            <span className="mx-1.5">·</span>
            {formatRelativeDate(video.release_date)}
          </p>

          <VideoToolbarActions />
        </div>
      </div>
    </TooltipProvider>
  );
}
