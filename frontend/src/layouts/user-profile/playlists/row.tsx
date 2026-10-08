import { Link } from "@tanstack/react-router";
import { CameraIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import type { PlaylistSummary } from "@/queries/playlist";

type PlaylistRowProps = {
  playlist: PlaylistSummary;
  username: string;
  isOwner: boolean;
  onRemove?: (playlistId: string) => void;
  className?: string;
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PlaylistRow({ playlist, username, isOwner, onRemove, className }: PlaylistRowProps) {
  const thumbnailUrl = playlist.thumbnail_url ?? null;
  const videoLabel = playlist.video_count === 1 ? "1 video" : `${String(playlist.video_count)} videos`;
  const visibilityLabel = playlist.visibility === "private" ? "Private" : "Public";

  return (
    <div
      className={cn(
        "relative flex w-full items-stretch gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 transition-colors hover:border-primary/40",
        className,
      )}
    >
      <Link
        to="/u/$username/playlists/$playlistId"
        params={{ username, playlistId: playlist.id }}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Open playlist ${playlist.name}`}
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-stretch gap-3">
        <div className="relative aspect-90/122 h-16 shrink-0 self-center overflow-hidden rounded bg-muted">
          {thumbnailUrl != null ? (
            <img src={thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <CameraIcon className="size-5 text-muted-foreground/70" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-medium">{playlist.name}</p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {visibilityLabel} · {videoLabel}
          </p>

          <p className="mt-auto pt-1 text-xs text-muted-foreground">
            Created: {formatDate(playlist.created_at)}
            {"  ·  "}
            Updated: {formatDate(playlist.updated_at)}
          </p>
        </div>
      </div>

      {isOwner && onRemove != null ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative z-20 size-7 shrink-0 self-start text-muted-foreground hover:text-destructive"
          aria-label={`Remove playlist ${playlist.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(playlist.id);
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
