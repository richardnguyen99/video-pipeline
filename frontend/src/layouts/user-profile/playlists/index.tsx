import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PlaylistCreateDialog } from "@/layouts/single-video/playlist-create-dialog";
import { PlaylistFilterMenu } from "@/layouts/user-profile/playlists/filter-menu";
import type { PlaylistOwnershipFilter, PlaylistVisibilityFilter } from "@/layouts/user-profile/playlists/filter-menu";
import { PlaylistPageRow } from "@/layouts/user-profile/playlists/page-row";
import { RemovePlaylistDialog } from "@/layouts/user-profile/playlists/remove-playlist-dialog";
import { PlaylistSortMenu } from "@/layouts/user-profile/playlists/sort-menu";
import type { PlaylistSort } from "@/layouts/user-profile/playlists/sort-menu";
import { getApiErrorMessage } from "@/libs/auth";
import {
  createPlaylist,
  deletePlaylist,
  playlistQueryKeys,
  playlistsQueryOptions,
  publicPlaylistsByUsernameQueryOptions,
  sharedPlaylistsQueryOptions,
} from "@/queries/playlist";
import type { PlaylistVisibility } from "@/queries/playlist";
import { useAuthStore } from "@/stores/auth-store";

type PlaylistsPageProps = {
  enabled: boolean;
  isOwner: boolean;
  username: string;
  visibility: PlaylistVisibilityFilter;
  ownership: PlaylistOwnershipFilter;
  sort: PlaylistSort;
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

function buildPlaylistsSearch(next: {
  visibility: PlaylistVisibilityFilter;
  ownership: PlaylistOwnershipFilter;
  sort: PlaylistSort;
}): {
  visibility?: PlaylistVisibilityFilter;
  ownership?: PlaylistOwnershipFilter;
  sort?: PlaylistSort;
} {
  return {
    visibility: next.visibility === "all" ? undefined : next.visibility,
    ownership: next.ownership === "all" ? undefined : next.ownership,
    sort: next.sort === "created" ? undefined : next.sort,
  };
}

export function PlaylistsPage({ enabled, isOwner, username, visibility, ownership, sort }: PlaylistsPageProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authUserId = useAuthStore((state) => state.user?.id);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const ownedQuery = useQuery({
    ...playlistsQueryOptions({
      limit: 100,
      offset: 0,
    }),
    enabled: enabled && isOwner,
    placeholderData: keepPreviousData,
  });

  const sharedQuery = useQuery({
    ...sharedPlaylistsQueryOptions({
      limit: 100,
      offset: 0,
    }),
    enabled: enabled && isOwner,
    placeholderData: keepPreviousData,
  });

  const publicQuery = useQuery({
    ...publicPlaylistsByUsernameQueryOptions(username, {
      limit: 100,
      offset: 0,
    }),
    enabled: enabled && !isOwner,
    placeholderData: keepPreviousData,
  });

  const playlistsQuery = isOwner ? ownedQuery : publicQuery;

  const playlists = useMemo(() => {
    const ownedItems = playlistsQuery.data?.items ?? [];
    const sharedItems = isOwner ? (sharedQuery.data?.items ?? []) : [];

    if (!isOwner || sharedItems.length === 0) {
      return ownedItems;
    }

    const seen = new Set(ownedItems.map((item) => item.id));
    const merged = [...ownedItems];

    for (const item of sharedItems) {
      if (!seen.has(item.id)) {
        merged.push(item);
        seen.add(item.id);
      }
    }

    return merged;
  }, [playlistsQuery.data?.items, sharedQuery.data?.items, isOwner]);

  const filteredPlaylists = useMemo(() => {
    const next = playlists.filter((playlist) => {
      if (visibility !== "all" && playlist.visibility !== visibility) {
        return false;
      }

      if (ownership === "mine") {
        if (authUserId == null || playlist.owner_id !== authUserId) {
          return false;
        }
      }

      if (ownership === "others") {
        if (authUserId != null && playlist.owner_id === authUserId) {
          return false;
        }
      }

      return true;
    });

    next.sort((left, right) => {
      if (sort === "videos") {
        const byCount = right.video_count - left.video_count;

        if (byCount !== 0) {
          return byCount;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

    return next;
  }, [playlists, visibility, ownership, authUserId, sort]);

  const isListLoading =
    !enabled ||
    (playlistsQuery.isPending && typeof playlistsQuery.data === "undefined") ||
    (isOwner && sharedQuery.isPending && typeof sharedQuery.data === "undefined");

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
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PlaylistFilterMenu
            visibility={visibility}
            ownership={ownership}
            onVisibilityChange={(nextVisibility) => {
              void navigate({
                to: "/u/$username/playlists",
                params: { username },
                search: buildPlaylistsSearch({
                  visibility: nextVisibility,
                  ownership,
                  sort,
                }),
                replace: true,
              });
            }}
            onOwnershipChange={(nextOwnership) => {
              void navigate({
                to: "/u/$username/playlists",
                params: { username },
                search: buildPlaylistsSearch({
                  visibility,
                  ownership: nextOwnership,
                  sort,
                }),
                replace: true,
              });
            }}
          />

          <PlaylistSortMenu
            sort={sort}
            onSortChange={(nextSort) => {
              void navigate({
                to: "/u/$username/playlists",
                params: { username },
                search: buildPlaylistsSearch({
                  visibility,
                  ownership,
                  sort: nextSort,
                }),
                replace: true,
              });
            }}
          />
        </div>

        {isOwner ? (
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
        ) : null}
      </div>

      {isListLoading ? (
        <PlaylistListSkeleton />
      ) : playlists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isOwner ? "Playlists you create will show up here." : "No public playlists yet."}
        </p>
      ) : filteredPlaylists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No playlists match the selected filters.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPlaylists.map((playlist) => {
            const ownsPlaylist = isOwner && authUserId != null && playlist.owner_id === authUserId;

            return (
              <PlaylistPageRow
                key={playlist.id}
                playlist={playlist}
                username={username}
                isOwner={ownsPlaylist}
                onRemove={
                  ownsPlaylist
                    ? (playlistId) => {
                        setPendingRemoveId(playlistId);
                      }
                    : undefined
                }
              />
            );
          })}
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
