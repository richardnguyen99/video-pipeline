import { TooltipProvider } from "@/components/ui/tooltip";
import { VideoToolbarActions } from "@/components/video/video-toolbar-action";
import { videoDisplayTitle } from "@/mocks/videos";
import type { Video } from "@/mocks/videos";
import { formatCompactNumber, formatRelativeDate } from "@/libs/utils";

interface VideoMetadataProps {
  video: Video;
}

export function VideoMetadata({ video }: VideoMetadataProps) {
  const views = video.views ?? 0;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <h1 className="text-xl font-bold leading-tight sm:text-2xl lg:text-3xl">{videoDisplayTitle(video)}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{formatCompactNumber(views)}</span> views
            <span className="mx-1.5">·</span>
            {formatRelativeDate(video.release_date)}
          </p>

          <VideoToolbarActions likes={video.likes ?? 0} dislikes={video.dislikes ?? 0} />
        </div>
      </div>
    </TooltipProvider>
  );
}
