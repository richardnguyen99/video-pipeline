import { Trash2 } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type DeletePlaylistMenuItemProps = {
  onSelect: () => void;
};

export function DeletePlaylistMenuItem({ onSelect }: DeletePlaylistMenuItemProps) {
  return (
    <DropdownMenuItem
      variant="destructive"
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <Trash2 className="size-4" aria-hidden />
      Delete playlist
    </DropdownMenuItem>
  );
}
