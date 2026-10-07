import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, ListPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlaylistCreateDialog } from "@/layouts/single-video/playlist-create-dialog";
import { getApiErrorMessage } from "@/libs/auth";
import { cn } from "@/libs/utils";
import {
  addVideoToPlaylist,
  createPlaylist,
  playlistQueryKeys,
  playlistsQueryOptions,
  removeVideoFromPlaylist,
} from "@/queries/playlist";
import type { PlaylistListPage, PlaylistSummary } from "@/queries/playlist";

import { VideoActionButton, videoActionBtnClass } from "./video-action-button";

const PLAYLIST_LIST_LIMIT = 50;

type PlaylistSaveButtonProps = {
  videoId: number;
  isAuthenticated: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

export function PlaylistSaveButton({
  videoId,
  isAuthenticated,
  mobileOpen,
  onMobileOpenChange,
}: PlaylistSaveButtonProps) {
  const queryClient = useQueryClient();
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const isMobileInstance = mobileOpen !== undefined && onMobileOpenChange !== undefined;

  const panelOpen = isMobileInstance ? Boolean(mobileOpen) : desktopOpen;

  const listOptions = playlistsQueryOptions({
    limit: PLAYLIST_LIST_LIMIT,
    offset: 0,
    videoId,
  });

  const playlistsQuery = useQuery({
    ...listOptions,
    enabled: isAuthenticated && panelOpen,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createPlaylist({ name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
      });
      setCreateOpen(false);
      toast.add({
        type: "success",
        title: "Playlist created",
        timeout: 3000,
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (playlist: PlaylistSummary) => {
      const inPlaylist = Boolean(playlist.contains_video);

      if (inPlaylist) {
        return removeVideoFromPlaylist(playlist.id, videoId);
      }

      return addVideoToPlaylist(playlist.id, videoId);
    },
    onMutate: async (playlist) => {
      await queryClient.cancelQueries({ queryKey: playlistQueryKeys.all });

      const queryKey = listOptions.queryKey;
      const previous = queryClient.getQueryData<PlaylistListPage>(queryKey);
      const wasIn = Boolean(playlist.contains_video);

      if (previous != null) {
        queryClient.setQueryData<PlaylistListPage>(queryKey, {
          ...previous,
          items: previous.items.map((item) => {
            if (item.id !== playlist.id) {
              return item;
            }

            const nextCount = wasIn ? Math.max(0, item.video_count - 1) : item.video_count + 1;

            return {
              ...item,
              contains_video: !wasIn,
              video_count: nextCount,
            };
          }),
        });
      }

      return { previous, queryKey, wasIn };
    },
    onError: (error, _playlist, context) => {
      if (context?.previous != null) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }

      toast.add({
        type: "error",
        title: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
    onSuccess: (_data, playlist) => {
      toast.add({
        type: "success",
        title: playlist.contains_video ? "Removed from playlist" : "Saved to playlist",
        timeout: 2500,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
      });
    },
  });

  const tooltip = isAuthenticated ? "Add this to my playlist" : "Log in to add this video to playlist";

  const playlists: Array<PlaylistSummary> = playlistsQuery.data?.items ?? [];
  const isInitialLoading = playlistsQuery.isPending;

  function openCreate() {
    setCreateOpen(true);
  }

  function handleToggle(playlist: PlaylistSummary) {
    if (toggleMutation.isPending) {
      return;
    }

    toggleMutation.mutate(playlist);
  }

  const createDialog = (
    <PlaylistCreateDialog
      open={createOpen}
      isPending={createMutation.isPending}
      onOpenChange={setCreateOpen}
      onSubmit={(name) => {
        createMutation.mutate(name);
      }}
    />
  );

  function membershipIcon(playlist: PlaylistSummary) {
    const inPlaylist = Boolean(playlist.contains_video);

    return (
      <Bookmark
        className={cn("size-4 shrink-0", inPlaylist ? "fill-primary text-primary" : "fill-none text-muted-foreground")}
        aria-label={inPlaylist ? "In playlist" : "Not in playlist"}
      />
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

  if (isMobileInstance) {
    return (
      <>
        <Dialog open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <DialogContent className="flex max-h-[90vh] w-[min(100%,24rem)] flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 flex-row items-center gap-2 px-4 py-3">
              <DialogTitle className="min-w-0 flex-1 text-base">Playlist</DialogTitle>

              <DialogClose />
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ScrollArea className="max-h-64">
                {isInitialLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading playlists…
                  </div>
                ) : null}

                {!isInitialLoading && playlists.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No playlists yet. Create one to get started.
                  </p>
                ) : null}

                {!isInitialLoading && playlists.length > 0 ? (
                  <ul className="flex flex-col gap-0.5 px-3 py-2">
                    {playlists.map((playlist) => (
                      <li key={playlist.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted"
                          disabled={toggleMutation.isPending}
                          onClick={() => {
                            handleToggle(playlist);
                          }}
                        >
                          <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                            {playlist.video_count}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{playlist.name}</p>

                            <p className="text-xs capitalize text-muted-foreground">{playlist.visibility}</p>
                          </div>

                          {membershipIcon(playlist)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </ScrollArea>

              <div className="shrink-0 border-t border-border px-3 py-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted"
                  onClick={openCreate}
                >
                  <ListPlus className="size-4 shrink-0" aria-hidden />
                  New playlist
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {createDialog}
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={desktopOpen} onOpenChange={setDesktopOpen}>
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
            <DropdownMenuLabel className="p-2 text-lg">Playlist</DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <div className="max-h-64 overflow-y-auto p-1">
            {isInitialLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading playlists…
              </div>
            ) : null}

            {!isInitialLoading && playlists.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No playlists yet. Create one to get started.
              </p>
            ) : null}

            {!isInitialLoading
              ? playlists.map((playlist) => (
                  <DropdownMenuItem
                    key={playlist.id}
                    className="gap-3 py-2.5 hover:bg-secondary!"
                    closeOnClick={false}
                    disabled={toggleMutation.isPending}
                    onClick={() => {
                      handleToggle(playlist);
                    }}
                  >
                    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      {playlist.video_count}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{playlist.name}</p>

                      <p className="text-xs capitalize text-muted-foreground">{playlist.visibility}</p>
                    </div>

                    {membershipIcon(playlist)}
                  </DropdownMenuItem>
                ))
              : null}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuGroup className="px-1 pb-1">
            <DropdownMenuItem
              className="group gap-3 py-2.5 focus:bg-secondary"
              closeOnClick={false}
              onClick={openCreate}
            >
              <ListPlus className="size-4" />
              <p>New playlist</p>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {createDialog}
    </>
  );
}
