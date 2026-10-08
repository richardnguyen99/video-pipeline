import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";

import { toast } from "@/components/ui/toast";
import { ChangeVisibilityDialog } from "@/layouts/user-profile/playlists/change-visibility-dialog";
import { DetailMenu } from "@/layouts/user-profile/playlists/detail-menu";
import { RemoveFromPlaylistDialog } from "@/layouts/user-profile/playlists/remove-from-playlist-dialog";
import { RemovePlaylistDialog } from "@/layouts/user-profile/playlists/remove-playlist-dialog";
import { RenamePlaylistDialog } from "@/layouts/user-profile/playlists/rename-playlist-dialog";
import { PlaylistVideoCard } from "@/layouts/user-profile/playlists/video-card";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { getApiErrorMessage } from "@/libs/auth";
import {
  changePlaylistVisibility,
  deletePlaylist,
  playlistDetailQueryOptions,
  playlistQueryKeys,
  removeVideoFromPlaylist,
  updatePlaylist,
} from "@/queries/playlist";
import type { PlaylistVisibility } from "@/queries/playlist";
import { useAuthStore } from "@/stores/auth-store";

type PlaylistDetailPageProps = {
  playlistId: string;
  enabled: boolean;
  isOwner: boolean;
  username: string;
};

function visibilityLabel(visibility: PlaylistVisibility): string {
  switch (visibility) {
    case "public":
      return "Public";
    case "restricted":
      return "Restricted";
    default:
      return "Private";
  }
}

export function PlaylistDetailPage({ playlistId, enabled, isOwner, username: usernameProp }: PlaylistDetailPageProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routeParams = useParams({
    from: "/u/$username/playlists/$playlistId",
  });
  const authUsername = useAuthStore((state) => state.user?.username);
  const username = routeParams.username || usernameProp || authUsername || "";
  const [pendingRemoveVideoId, setPendingRemoveVideoId] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailQuery = useQuery({
    ...playlistDetailQueryOptions(playlistId),
    enabled,
    placeholderData: keepPreviousData,
  });

  const playlist = detailQuery.data;
  const videos = playlist?.videos ?? [];
  const isLoading = enabled && detailQuery.isPending && typeof detailQuery.data === "undefined";

  const removeVideoMutation = useMutation({
    mutationFn: (videoId: number) => removeVideoFromPlaylist(playlistId, videoId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
      });
      setPendingRemoveVideoId(null);
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

  const renameMutation = useMutation({
    mutationFn: (name: string) => updatePlaylist(playlistId, { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
      });
      setRenameOpen(false);
      toast.add({
        type: "success",
        title: "Playlist renamed",
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

  const visibilityMutation = useMutation({
    mutationFn: (visibility: PlaylistVisibility) => changePlaylistVisibility(playlistId, visibility),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
      });
      setVisibilityOpen(false);
      toast.add({
        type: "success",
        title: "Visibility updated",
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

  const deleteMutation = useMutation({
    mutationFn: () => deletePlaylist(playlistId),
    onSuccess: async () => {
      setDeleteOpen(false);
      toast.add({
        type: "success",
        title: "Playlist deleted",
        timeout: 3000,
      });

      if (username.length > 0) {
        await navigate({
          to: "/u/$username/playlists",
          params: { username },
          replace: true,
        });
      } else {
        await navigate({
          to: "/",
          replace: true,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.all,
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight">
            {playlist.name}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {playlist.video_count} {playlist.video_count === 1 ? "video" : "videos"}
            </span>
          </h3>

          <p className="text-sm text-muted-foreground">
            {visibilityLabel(playlist.visibility)}
            {playlist.description != null && playlist.description.length > 0 ? ` · ${playlist.description}` : null}
          </p>
        </div>

        {isOwner ? (
          <DetailMenu
            onRename={() => {
              setRenameOpen(true);
            }}
            onChangeVisibility={() => {
              setVisibilityOpen(true);
            }}
            onDelete={() => {
              setDeleteOpen(true);
            }}
          />
        ) : null}
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
                setPendingRemoveVideoId(videoId);
              }}
            />
          ))}
        </div>
      )}

      <RemoveFromPlaylistDialog
        open={pendingRemoveVideoId != null}
        isPending={removeVideoMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !removeVideoMutation.isPending) {
            setPendingRemoveVideoId(null);
          }
        }}
        onConfirm={() => {
          if (pendingRemoveVideoId == null) {
            return;
          }

          removeVideoMutation.mutate(pendingRemoveVideoId);
        }}
      />

      <RenamePlaylistDialog
        key={`rename-${playlist.name}-${String(renameOpen)}`}
        open={renameOpen}
        isPending={renameMutation.isPending}
        currentName={playlist.name}
        onOpenChange={(open) => {
          if (!open && !renameMutation.isPending) {
            setRenameOpen(false);
          }
        }}
        onSubmit={(name) => {
          renameMutation.mutate(name);
        }}
      />

      <ChangeVisibilityDialog
        key={`visibility-${playlist.visibility}-${String(visibilityOpen)}`}
        open={visibilityOpen}
        isPending={visibilityMutation.isPending}
        currentVisibility={playlist.visibility}
        onOpenChange={(open) => {
          if (!open && !visibilityMutation.isPending) {
            setVisibilityOpen(false);
          }
        }}
        onSubmit={(visibility) => {
          visibilityMutation.mutate(visibility);
        }}
      />

      <RemovePlaylistDialog
        open={deleteOpen}
        isPending={deleteMutation.isPending}
        playlistName={playlist.name}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setDeleteOpen(false);
          }
        }}
        onConfirm={() => {
          deleteMutation.mutate();
        }}
      />
    </>
  );
}
