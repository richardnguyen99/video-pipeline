import { CameraIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import type { PlaylistSummary } from "@/queries/playlist";

type PlaylistRowProps = {
  playlist: PlaylistSummary;
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

export function PlaylistRow({ playlist, isOwner, onRemove, className }: PlaylistRowProps) {
  const thumbnailUrl = playlist.thumbnail_url ?? null;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5",
        className,
      )}
    >
      <div className="relative aspect-90/122 h-16 shrink-0 overflow-hidden rounded bg-muted">
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
          <span className="font-normal text-muted-foreground">
            {" "}
            · {playlist.video_count} video{playlist.video_count > 1 ? "s" : ""}
          </span>
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          Created: {formatDate(playlist.created_at)}
          {"  ·  "}
          Updated: {formatDate(playlist.updated_at)}
        </p>
      </div>

      {isOwner && onRemove != null ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Remove playlist ${playlist.name}`}
          onClick={() => {
            onRemove(playlist.id);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
