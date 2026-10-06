import { Link } from "@tanstack/react-router";
import { Eye, MessageCircle, ThumbsUp } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { commentCount, watchProgressPercent, watchedThumbnail } from "@/layouts/user-profile/videos/watched-thumbnail";
import { formatCompactNumber } from "@/libs/utils";
import type { WatchedVideo } from "@/queries/video-watch";

type WatchedCardProps = {
  video: WatchedVideo;
  index: number;
};

export function WatchedCard({ video, index }: WatchedCardProps) {
  const views = video.views ?? 0;
  const likes = video.likes ?? 0;
  const comments = commentCount(video);
  const poster = watchedThumbnail(video);
  const progressPercent = watchProgressPercent(video);

  return (
    <Link
      to="/videos/$id"
      params={{ id: String(video.id) }}
      className="overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <img src={poster} alt={video.video_id} loading="lazy" className="size-full object-cover" />

        <span className="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
          {index + 1}
        </span>
      </div>

      <Progress value={progressPercent} className="h-1 rounded-none" />

      <div className="p-3">
        <h4 className="line-clamp-2 text-sm font-medium">{video.video_id}</h4>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
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
    </Link>
  );
}
