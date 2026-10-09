import { Link, useNavigate } from "@tanstack/react-router";
import { CameraIcon, EditIcon, SquareIcon, SquarePlayIcon, Trash2, UserPenIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VisibilityTag } from "@/layouts/user-profile/playlists/visibility-tag";
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
  const navigate = useNavigate();
  const thumbnailUrl = playlist.thumbnail_url ?? null;
  const ownerUsername = playlist.owner_username.length > 0 ? playlist.owner_username : username;
  const videoLabel = playlist.video_count === 1 ? "1 video" : `${String(playlist.video_count)} videos`;
  const createdLabel = formatDate(playlist.created_at);
  const updatedLabel = formatDate(playlist.updated_at);
  const ownedByLabel = `Owned by ${ownerUsername}`;
  const createdAtLabel = `Created ${createdLabel}`;
  const updatedAtLabel = `Updated ${updatedLabel}`;

  const openPlaylist = () => {
    void navigate({
      to: "/u/$username/playlists/$playlistId",
      params: { username: ownerUsername, playlistId: playlist.id },
    });
  };

  return (
    <div
      className={cn(
        "relative flex w-full items-stretch gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 transition-colors hover:border-primary/40",
        className,
      )}
    >
      <Link
        to="/u/$username/playlists/$playlistId"
        params={{ username: ownerUsername, playlistId: playlist.id }}
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
          <div className="mt-0.5 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
            <p className="line-clamp-1 min-w-0 shrink text-sm font-semibold text-foreground">{playlist.name}</p>

            <VisibilityTag visibility={playlist.visibility} className="shrink-0" />
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger
                className="pointer-events-auto hover:cursor-pointer flex flex-nowrap items-center gap-1.5"
                aria-label={videoLabel}
                onClick={openPlaylist}
              >
                <SquarePlayIcon className="size-4 text-muted-foreground/70" aria-hidden />
                <span>{playlist.video_count}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{videoLabel}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                className="pointer-events-auto hover:cursor-pointer flex flex-nowrap items-center gap-1.5"
                aria-label={ownedByLabel}
                onClick={openPlaylist}
              >
                <UserPenIcon className="size-4 text-muted-foreground/70" aria-hidden />
                <span>{ownerUsername}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{ownedByLabel}</TooltipContent>
            </Tooltip>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger
                className="pointer-events-auto hover:cursor-pointer flex flex-nowrap items-center gap-1.5"
                aria-label={createdAtLabel}
                onClick={openPlaylist}
              >
                <SquareIcon className="size-4 text-muted-foreground/70" aria-hidden />
                <span>{createdLabel}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{createdAtLabel}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                className="pointer-events-auto hover:cursor-pointer flex flex-nowrap items-center gap-1.5"
                aria-label={updatedAtLabel}
                onClick={openPlaylist}
              >
                <EditIcon className="size-4 text-muted-foreground/70" aria-hidden />
                <span>{updatedLabel}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{updatedAtLabel}</TooltipContent>
            </Tooltip>
          </div>
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
