import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { PlaylistRow } from "@/layouts/user-profile/playlists/row";
import { RemovePlaylistDialog } from "@/layouts/user-profile/playlists/remove-playlist-dialog";
import { getApiErrorMessage } from "@/libs/auth";
import { deletePlaylist, playlistQueryKeys } from "@/queries/playlist";
import type { PlaylistSummary } from "@/queries/playlist";

type PlaylistSectionProps = {
  playlists: Array<PlaylistSummary>;
  username: string;
  isOwner: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
};

export function PlaylistSection({
  playlists,
  username,
  isOwner,
  isLoading = false,
  emptyMessage = "No playlists yet.",
}: PlaylistSectionProps) {
  const queryClient = useQueryClient();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

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
      <div className="flex flex-col gap-2">
        <div className="h-16 animate-pulse rounded-lg bg-muted/60" />

        <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
      </div>
    );
  }

  if (playlists.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {playlists.map((playlist) => (
          <PlaylistRow
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
