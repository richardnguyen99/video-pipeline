import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { PlaylistVideoCard } from "@/layouts/user-profile/playlists/video-card";
import { RemoveFromPlaylistDialog } from "@/layouts/user-profile/playlists/remove-from-playlist-dialog";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { getApiErrorMessage } from "@/libs/auth";
import { playlistDetailQueryOptions, playlistQueryKeys, removeVideoFromPlaylist } from "@/queries/playlist";

type PlaylistDetailPageProps = {
  playlistId: string;
  enabled: boolean;
  isOwner: boolean;
};

export function PlaylistDetailPage({ playlistId, enabled, isOwner }: PlaylistDetailPageProps) {
  const queryClient = useQueryClient();
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);

  const detailQuery = useQuery({
    ...playlistDetailQueryOptions(playlistId),
    enabled,
    placeholderData: keepPreviousData,
  });

  const playlist = detailQuery.data;
  const videos = playlist?.videos ?? [];
  const isLoading = enabled && detailQuery.isPending && typeof detailQuery.data === "undefined";

  const removeMutation = useMutation({
    mutationFn: (videoId: number) => removeVideoFromPlaylist(playlistId, videoId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
      });
      setPendingRemoveId(null);
      toast.add({
        type: "success",
        title: "Removed from playlist",
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <WatchedCardSkeleton key={index} index={index} />
        ))}
      </div>
    );
  }

  if (playlist == null) {
    return <p className="text-sm text-muted-foreground">Playlist not found.</p>;
  }

  return (
    <>
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold tracking-tight">
          {playlist.name}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {playlist.video_count} {playlist.video_count === 1 ? "video" : "videos"}
          </span>
        </h3>

        <p className="text-sm text-muted-foreground">
          {playlist.visibility === "private" ? "Private" : "Public"}
          {playlist.description != null && playlist.description.length > 0 ? ` · ${playlist.description}` : null}
        </p>
      </div>

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Videos added to this playlist will show up here.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <PlaylistVideoCard
              key={video.id}
              video={video}
              isOwner={isOwner}
              onRemoveFromPlaylist={(videoId) => {
                setPendingRemoveId(videoId);
              }}
            />
          ))}
        </div>
      )}

      <RemoveFromPlaylistDialog
        open={pendingRemoveId != null}
        isPending={removeMutation.isPending}
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
