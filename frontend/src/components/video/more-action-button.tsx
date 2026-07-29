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
        render={<Button variant="secondary" className={videoActionBtnClass} aria-label="More actions" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleSaveToPlaylist}>
            <ListPlus className="size-4" />
            Save to playlist
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="size-4" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onReport}>
            <Flag className="size-4" />
            Report
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
