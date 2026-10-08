import { Link } from "@tanstack/react-router";
import { CameraIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import { VisibilityTag } from "@/layouts/user-profile/playlists/visibility-tag";
import type { PlaylistSummary } from "@/queries/playlist";

type PlaylistPageRowProps = {
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

export function PlaylistPageRow({ playlist, username, isOwner, onRemove, className }: PlaylistPageRowProps) {
  const thumbnailUrl = playlist.thumbnail_url ?? null;
  const videoLabel = playlist.video_count === 1 ? "1 video" : `${String(playlist.video_count)} videos`;
  return (
    <div
      className={cn(
        "relative flex w-full items-stretch gap-4 rounded-xl border border-border/60 bg-card/40 px-4 py-3.5 transition-colors hover:border-primary/40",
        className,
      )}
    >
      <Link
        to="/u/$username/playlists/$playlistId"
        params={{ username, playlistId: playlist.id }}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Open playlist ${playlist.name}`}
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-stretch gap-4">
        <div className="relative aspect-90/122 h-24 shrink-0 self-center overflow-hidden rounded-md bg-muted">
          {thumbnailUrl != null ? (
            <img src={thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <CameraIcon className="size-7 text-muted-foreground/70" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-base font-medium">{playlist.name}</p>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <VisibilityTag visibility={playlist.visibility} />
            <span>· {videoLabel}</span>
          </div>

          <p className="mt-auto pt-2 text-sm text-muted-foreground">
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
          className="relative z-20 size-8 shrink-0 self-start text-muted-foreground hover:text-destructive"
          aria-label={`Remove playlist ${playlist.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(playlist.id);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
