import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PlaylistCreateDialog } from "@/layouts/single-video/playlist-create-dialog";
import { PlaylistPageRow } from "@/layouts/user-profile/playlists/page-row";
import { RemovePlaylistDialog } from "@/layouts/user-profile/playlists/remove-playlist-dialog";
import { getApiErrorMessage } from "@/libs/auth";
import { createPlaylist, deletePlaylist, playlistQueryKeys, playlistsQueryOptions } from "@/queries/playlist";
import type { PlaylistVisibility } from "@/queries/playlist";

type PlaylistsPageProps = {
  enabled: boolean;
  isOwner: boolean;
  username: string;
};

function PlaylistListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-28 animate-pulse rounded-xl bg-muted/60" />

      <div className="h-28 animate-pulse rounded-xl bg-muted/60" />

      <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}

export function PlaylistsPage({ enabled, isOwner, username }: PlaylistsPageProps) {
  const queryClient = useQueryClient();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const playlistsQuery = useQuery({
    ...playlistsQueryOptions({
      limit: 100,
      offset: 0,
    }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const playlists = playlistsQuery.data?.items ?? [];
  const isListLoading = !enabled || (playlistsQuery.isPending && typeof playlistsQuery.data === "undefined");

  const pendingPlaylist = playlists.find((item) => item.id === pendingRemoveId);

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; visibility: PlaylistVisibility }) => createPlaylist(payload),
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

  const removeMutation = useMutation({
    mutationFn: (playlistId: string) => deletePlaylist(playlistId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
      });
      setPendingRemoveId(null);
      toast.add({
        type: "success",
        title: "Playlist deleted",
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

  return (
    <>
      {isOwner ? (
        <div className="mb-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New playlist
          </Button>
        </div>
      ) : null}

      {isListLoading ? (
        <PlaylistListSkeleton />
      ) : playlists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isOwner ? "Playlists you create will show up here." : "No public playlists yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {playlists.map((playlist) => (
            <PlaylistPageRow
              key={playlist.id}
              playlist={playlist}
              username={username}
              isOwner={isOwner}
              onRemove={
                isOwner
                  ? (playlistId) => {
                      setPendingRemoveId(playlistId);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <PlaylistCreateDialog
        open={createOpen}
        isPending={createMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending) {
            setCreateOpen(false);
          }
        }}
        onSubmit={(payload) => {
          createMutation.mutate(payload);
        }}
      />

      <RemovePlaylistDialog
        open={pendingRemoveId != null}
        isPending={removeMutation.isPending}
        playlistName={pendingPlaylist?.name}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) {
            setPendingRemoveId(null);
          }
        }}
        onConfirm={() => {
          if (pendingRemoveId == null) {
            return;
          }

          removeMutation.mutate(pendingRemoveId);
        }}
      />
    </>
  );
}
