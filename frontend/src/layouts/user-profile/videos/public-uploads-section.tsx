import { Link } from "@tanstack/react-router";
import { Eye, MessageCircle, ThumbsUp } from "lucide-react";

import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { commentCount, watchedThumbnail } from "@/layouts/user-profile/videos/watched-thumbnail";
import { formatCompactNumber } from "@/libs/utils";
import type { Video } from "@/mocks/videos";

type PublicUploadsSectionProps = {
  videos: Array<Video>;
  isLoading: boolean;
  isOwner: boolean;
};

export function PublicUploadsSection({ videos, isLoading, isOwner }: PublicUploadsSectionProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <WatchedCardSkeleton index={0} />

        <WatchedCardSkeleton index={1} />

        <WatchedCardSkeleton index={2} />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {isOwner ? "Public videos you upload will show up here." : "Public videos will show up here."}
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <PublicUploadCard key={video.id} video={video} />
      ))}
    </div>
  );
}

function PublicUploadCard({ video }: { video: Video }) {
  const views = video.views ?? 0;
  const likes = video.likes ?? 0;
  const comments = commentCount(video);
  const poster = watchedThumbnail(video);
  const title = video.title || video.video_id;

  return (
    <div className="border-border/60 bg-card/40 group overflow-hidden rounded-xl border transition-colors hover:border-primary/40">
      <div className="bg-muted relative aspect-video overflow-hidden">
        <Link to="/videos/$id" params={{ id: String(video.id) }} className="absolute inset-0 block">
          <img src={poster} alt={title} loading="lazy" className="size-full object-cover" />
        </Link>
      </div>

      <Link to="/videos/$id" params={{ id: String(video.id) }} className="block p-3">
        <h4 className="line-clamp-2 text-sm font-medium">{title}</h4>

        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
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
