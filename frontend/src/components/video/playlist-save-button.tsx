import { useState } from "react";
import { Check, ListPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { VideoActionButton, videoActionBtnClass } from "./video-action-button";

export interface PlaylistOption {
  id: number;
  name: string;
  visibility: string;
  thumbnail: string;
  inPlaylist: boolean;
}

const DEFAULT_PLAYLISTS: PlaylistOption[] = [
  {
    id: 1,
    name: "Favorites",
    visibility: "private",
    thumbnail: "https://picsum.photos/id/1015/80/45",
    inPlaylist: true,
  },
  {
    id: 2,
    name: "Watch Later",
    visibility: "private",
    thumbnail: "https://picsum.photos/id/1027/80/45",
    inPlaylist: false,
  },
  {
    id: 3,
    name: "Best of 2024",
    visibility: "public",
    thumbnail: "https://picsum.photos/id/106/80/45",
    inPlaylist: false,
  },
  {
    id: 4,
    name: "Action",
    visibility: "public",
    thumbnail: "https://picsum.photos/id/201/80/45",
    inPlaylist: true,
  },
];

interface PlaylistSaveButtonProps {
  isAuthenticated: boolean;
  playlists?: PlaylistOption[];
}

export function PlaylistSaveButton({
  isAuthenticated,
  playlists: initialPlaylists = DEFAULT_PLAYLISTS,
}: PlaylistSaveButtonProps) {
  const [playlists, setPlaylists] = useState<PlaylistOption[]>(initialPlaylists);

  const tooltip = isAuthenticated ? "Add this to my playlist" : "Log in to add this video to playlist";

  function handleTogglePlaylist(id: number) {
    setPlaylists((prev) =>
      prev.map((playlist) => (playlist.id === id ? { ...playlist, inPlaylist: !playlist.inPlaylist } : playlist)),
    );
  }

  if (!isAuthenticated) {
    return (
      <VideoActionButton tooltip={tooltip}>
        <ListPlus className="size-4" />
        <span>Save</span>
      </VideoActionButton>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={<DropdownMenuTrigger render={<Button variant="secondary" className={videoActionBtnClass} />} />}
        >
          <ListPlus className="size-4" />
          <span>Save</span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-lg p-2">Playlist</DropdownMenuLabel>
          <div className="max-h-64 overflow-y-auto p-1">
            {playlists.map((playlist) => (
              <DropdownMenuItem
                key={playlist.id}
                className="gap-3 py-2.5"
                onClick={() => handleTogglePlaylist(playlist.id)}
              >
                <img src={playlist.thumbnail} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{playlist.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{playlist.visibility}</p>
                </div>
                {playlist.inPlaylist ? (
                  <Check className="size-4 shrink-0" />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border border-muted-foreground/40" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="px-1 pb-1">
          <DropdownMenuItem className="group gap-3 py-2.5 focus:bg-secondary">
            <ListPlus className="size-4 " />
            <p>New playlist</p>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
