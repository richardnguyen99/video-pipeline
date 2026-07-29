import { Flag, ListPlus, MoreHorizontal, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { videoActionBtnClass } from "./video-action-button";
import { cn } from "@/libs/utils";

interface MoreActionsMenuProps {
  isAuthenticated: boolean;
  onReport: () => void;
}

export function MoreActionsMenu({ isAuthenticated, onReport }: MoreActionsMenuProps) {
  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
  }

  function handleSaveToPlaylist() {
    if (!isAuthenticated) return;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="secondary" className={cn(videoActionBtnClass)} aria-label="More actions" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleSaveToPlaylist} className="group gap-3 py-2 focus:bg-secondary">
            <ListPlus className="size-4" />
            <p>Save to playlist</p>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare} className="group gap-3 py-2 focus:bg-secondary">
            <Share2 className="size-4" />
            <p>Share</p>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onReport} className="group gap-3 py-2 focus:bg-secondary">
            <Flag className="size-4" />
            <p>Report</p>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
