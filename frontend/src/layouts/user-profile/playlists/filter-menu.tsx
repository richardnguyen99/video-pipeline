import { ListFilter } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlaylistVisibility } from "@/queries/playlist";

export type PlaylistVisibilityFilter = "all" | PlaylistVisibility;
export type PlaylistOwnershipFilter = "all" | "mine" | "others";

type PlaylistFilterMenuProps = {
  visibility: PlaylistVisibilityFilter;
  ownership: PlaylistOwnershipFilter;
  onVisibilityChange: (value: PlaylistVisibilityFilter) => void;
  onOwnershipChange: (value: PlaylistOwnershipFilter) => void;
};

export function PlaylistFilterMenu({
  visibility,
  ownership,
  onVisibilityChange,
  onOwnershipChange,
}: PlaylistFilterMenuProps) {
  const isFiltered = visibility !== "all" || ownership !== "all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        aria-label="Filter playlists"
      >
        <ListFilter className="size-4 shrink-0" aria-hidden />
        Filter
        {isFiltered ? <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="bottom" className="min-w-52 p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Visibility</DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={visibility}
            onValueChange={(value) => {
              onVisibilityChange(value as PlaylistVisibilityFilter);
            }}
          >
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="public">Public</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="restricted">Restricted</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="private">Private</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Ownership</DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={ownership}
            onValueChange={(value) => {
              onOwnershipChange(value as PlaylistOwnershipFilter);
            }}
          >
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="mine">Owned by me</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="others">Owned by others</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
