import { Flag, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommentMoreMenuProps {
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}

export function CommentMoreMenu({ isOwner, onEdit, onDelete, onReport }: CommentMoreMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 text-muted-foreground"
            aria-label="Comment actions"
          />
        }
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuGroup>
          {isOwner ? (
            <>
              <DropdownMenuItem className="gap-2" onClick={onEdit}>
                <Pencil className="size-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-destructive" onClick={onDelete}>
                <Trash2 className="size-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem className="gap-2" onClick={onReport}>
              <Flag className="size-4" />
              <span>Report</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
