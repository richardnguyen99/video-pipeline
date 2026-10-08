import { Ellipsis } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangeVisibilityMenuItem } from "@/layouts/user-profile/playlists/change-visibility-menu-item";
import { DeletePlaylistMenuItem } from "@/layouts/user-profile/playlists/delete-playlist-menu-item";
import { RenameMenuItem } from "@/layouts/user-profile/playlists/rename-menu-item";

type DetailMenuProps = {
  onRename: () => void;
  onChangeVisibility: () => void;
  onDelete: () => void;
};

export function DetailMenu({ onRename, onChangeVisibility, onDelete }: DetailMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Playlist options"
      >
        <Ellipsis className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" className="min-w-52 p-2">
        <DropdownMenuGroup>
          <RenameMenuItem onSelect={onRename} />

          <ChangeVisibilityMenuItem onSelect={onChangeVisibility} />

          <DeletePlaylistMenuItem onSelect={onDelete} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
