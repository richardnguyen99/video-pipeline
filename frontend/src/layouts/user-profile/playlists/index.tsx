import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { PlaylistPageRow } from "@/layouts/user-profile/playlists/page-row";
import { RemovePlaylistDialog } from "@/layouts/user-profile/playlists/remove-playlist-dialog";
import { getApiErrorMessage } from "@/libs/auth";
import { deletePlaylist, playlistQueryKeys, playlistsQueryOptions } from "@/queries/playlist";

type PlaylistsPageProps = {
  enabled: boolean;
  isOwner: boolean;
  username: string;
};

export function PlaylistsPage({ enabled, isOwner, username }: PlaylistsPageProps) {
  const queryClient = useQueryClient();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const playlistsQuery = useQuery({
    ...playlistsQueryOptions({
      limit: 100,
      offset: 0,
    }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const playlists = playlistsQuery.data?.items ?? [];
  const isLoading = enabled && playlistsQuery.isPending && typeof playlistsQuery.data === "undefined";

  const pendingPlaylist = playlists.find((item) => item.id === pendingRemoveId);

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-28 animate-pulse rounded-xl bg-muted/60" />

        <div className="h-28 animate-pulse rounded-xl bg-muted/60" />

        <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {isOwner ? "Playlists you create will show up here." : "No public playlists yet."}
      </p>
    );
  }

  return (
    <>
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
