import { Link } from "@tanstack/react-router";
import { Eye, MessageCircle, ThumbsUp } from "lucide-react";

import { LikedCardMenu } from "@/layouts/user-profile/videos/liked-card-menu";
import { commentCount, watchedThumbnail } from "@/layouts/user-profile/videos/watched-thumbnail";
import { formatCompactNumber } from "@/libs/utils";
import type { Video } from "@/mocks/videos";

type LikedCardProps = {
  video: Video;
  onSaveToPlaylists?: (videoId: number) => void;
  onRemoveFromLiked?: (videoId: number) => void;
};

export function LikedCard({ video, onSaveToPlaylists, onRemoveFromLiked }: LikedCardProps) {
  const views = video.views ?? 0;
  const likes = video.likes ?? 0;
  const comments = commentCount(video);
  const poster = watchedThumbnail(video);

  return (
    <div className="group overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-primary/40">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <Link to="/videos/$id" params={{ id: String(video.id) }} className="absolute inset-0 block">
          <img src={poster} alt={video.video_id} loading="lazy" className="size-full object-cover" />
        </Link>

        <div className="absolute top-2 right-2 z-10">
          <LikedCardMenu
            videoId={video.id}
            onSaveToPlaylists={onSaveToPlaylists}
            onRemoveFromLiked={onRemoveFromLiked}
          />
        </div>
      </div>

      <Link to="/videos/$id" params={{ id: String(video.id) }} className="block p-3">
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
      </Link>
    </div>
  );
}
