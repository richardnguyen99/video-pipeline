import { Play } from "lucide-react";

import type { UserPlaylistItem } from "@/queries/user-profile";

type PlaylistCardProps = {
  playlist: UserPlaylistItem;
  index: number;
  isOwner: boolean;
};

export function PlaylistCard({ playlist, index, isOwner }: PlaylistCardProps) {
  return (
    <article className="flex gap-3 rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="relative flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
        <span className="absolute top-1 left-1 text-[10px] font-medium text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>

        <Play className="size-5 text-muted-foreground" aria-hidden />
      </div>

      <div className="min-w-0">
        <h4 className="line-clamp-2 text-sm font-medium">{playlist.title}</h4>

        <p className="mt-1 text-xs text-muted-foreground">
          {playlist.video_count} videos
          {isOwner ? " · Updated recently" : " · Public playlist"}
        </p>
      </div>
    </article>
  );
}
