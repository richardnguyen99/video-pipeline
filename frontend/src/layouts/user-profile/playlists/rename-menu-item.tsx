import { Pencil } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type RenameMenuItemProps = {
  onSelect: () => void;
};

export function RenameMenuItem({ onSelect }: RenameMenuItemProps) {
  return (
    <DropdownMenuItem
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <Pencil className="size-4" aria-hidden />
      Rename
    </DropdownMenuItem>
  );
}
