import { Ellipsis, ListMinus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlaylistVideoCardMenuProps = {
  videoId: number;
  onRemoveFromPlaylist?: (videoId: number) => void;
};

export function PlaylistVideoCardMenu({ videoId, onRemoveFromPlaylist }: PlaylistVideoCardMenuProps) {
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
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemoveFromPlaylist?.(videoId);
            }}
          >
            <ListMinus className="size-4" aria-hidden />
            Remove from playlist
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
