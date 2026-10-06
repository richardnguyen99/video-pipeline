import { BookmarkPlus, Ellipsis, History } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type WatchedCardMenuProps = {
  videoId: number;
  onSaveToPlaylists?: (videoId: number) => void;
  onRemoveFromHistory?: (videoId: number) => void;
};

export function WatchedCardMenu({ videoId, onSaveToPlaylists, onRemoveFromHistory }: WatchedCardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-full bg-background/50 text-foreground shadow-sm ring-1 ring-border/60 transition-colors hover:bg-background/75 hover:text-primary"
        aria-label="Video options"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <Ellipsis className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" className="min-w-60 p-2">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSaveToPlaylists?.(videoId);
            }}
          >
            <BookmarkPlus className="size-4" aria-hidden />
            Save to playlists
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemoveFromHistory?.(videoId);
            }}
          >
            <History className="size-4" aria-hidden />
            Remove from watch history
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
