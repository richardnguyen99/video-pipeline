import { Play } from "lucide-react";

import type { UserVideoItem } from "@/queries/user-profile";

type LibraryVideoCardProps = {
  video: UserVideoItem;
  index: number;
  isOwner: boolean;
};

export function LibraryVideoCard({ video, index, isOwner }: LibraryVideoCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
      <div className="relative flex aspect-video items-center justify-center bg-muted">
        <span className="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
          {index + 1}
        </span>

        <Play className="size-8 text-muted-foreground" aria-hidden />
      </div>

      <div className="p-3">
        <h4 className="line-clamp-2 text-sm font-medium">{video.title}</h4>

        <p className="mt-1 text-xs text-muted-foreground">{isOwner ? `${video.views} views` : "Public video"}</p>
      </div>
    </article>
  );
}
