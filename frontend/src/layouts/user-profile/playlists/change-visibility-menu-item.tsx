import { Eye } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type ChangeVisibilityMenuItemProps = {
  onSelect: () => void;
};

export function ChangeVisibilityMenuItem({ onSelect }: ChangeVisibilityMenuItemProps) {
  return (
    <DropdownMenuItem
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <Eye className="size-4" aria-hidden />
      Change visibility
    </DropdownMenuItem>
  );
}
