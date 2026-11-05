import { useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, Ellipsis, Upload } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PublicUploadCardMenuProps = {
  videoId: number;
  publicId?: string | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  onSaveToPlaylists?: (videoId: number) => void;
};

export function PublicUploadCardMenu({
  videoId,
  publicId,
  isAuthenticated,
  isOwner,
  onSaveToPlaylists,
}: PublicUploadCardMenuProps) {
  const navigate = useNavigate();
  const showSave = isAuthenticated;
  const showGoToUpload = isOwner && publicId != null && publicId.length > 0;

  if (!showSave && !showGoToUpload) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="bg-background/50 text-foreground ring-border/60 hover:bg-background/75 hover:text-primary inline-flex size-8 items-center justify-center rounded-full shadow-sm ring-1 transition-colors"
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
          {showSave ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSaveToPlaylists?.(videoId);
              }}
            >
              <BookmarkPlus className="size-4" aria-hidden />
              Save to playlists
            </DropdownMenuItem>
          ) : null}

          {showGoToUpload ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void navigate({
                  to: "/studio/uploads/$uploadId",
                  params: { uploadId: publicId },
                });
              }}
            >
              <Upload className="size-4" aria-hidden />
              Go to upload
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
