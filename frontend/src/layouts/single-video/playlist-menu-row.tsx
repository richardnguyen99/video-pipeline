import { Bookmark } from "lucide-react";

import { cn } from "@/libs/utils";
import type { PlaylistSummary } from "@/queries/playlist";

type PlaylistMenuRowProps = {
  playlist: PlaylistSummary;
  className?: string;
};

export function PlaylistMenuRow({ playlist, className }: PlaylistMenuRowProps) {
  const inPlaylist = Boolean(playlist.contains_video);
  const thumbnailUrl = playlist.thumbnail_url ?? null;

  return (
    <div className={cn("flex w-full items-center gap-3", className)}>
      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
        {thumbnailUrl != null ? (
          <img src={thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {playlist.name}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {playlist.video_count} video{playlist.video_count > 1 ? "s" : ""}
          </span>
        </p>

        <p className="text-xs capitalize text-muted-foreground">{playlist.visibility}</p>
      </div>

      <Bookmark
        className={cn("size-4 shrink-0", inPlaylist ? "fill-primary text-primary" : "fill-none text-muted-foreground")}
        aria-label={inPlaylist ? "In playlist" : "Not in playlist"}
      />
    </div>
  );
}
