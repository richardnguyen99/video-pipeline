import { ArrowUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PlaylistSort = "created" | "videos";

type PlaylistSortMenuProps = {
  sort: PlaylistSort;
  onSortChange: (value: PlaylistSort) => void;
};

export function PlaylistSortMenu({ sort, onSortChange }: PlaylistSortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        aria-label="Sort playlists"
      >
        <ArrowUpDown className="size-4 shrink-0" aria-hidden />
        Sort
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="bottom" className="min-w-52 p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(value) => {
              onSortChange(value as PlaylistSort);
            }}
          >
            <DropdownMenuRadioItem value="created">Last created</DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="videos">Videos</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
