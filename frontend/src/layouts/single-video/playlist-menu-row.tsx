import { Bookmark, CameraIcon } from "lucide-react";

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
      <div className="relative flex aspect-90/122 h-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {thumbnailUrl != null ? (
          <img src={thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <CameraIcon className="size-5 text-muted-foreground/70" aria-hidden />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {playlist.name}
          <span className="font-normal text-muted-foreground"> · {playlist.video_count}</span>
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
