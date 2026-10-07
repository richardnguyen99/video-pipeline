import { Suspense } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { Panel as VideosPanel } from "@/layouts/user-profile/videos";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { playlistsQueryOptions } from "@/queries/playlist";
import { userVideosQueryOptions } from "@/queries/user-profile";
import type { UserVideoItem } from "@/queries/user-profile";
import { likedVideosQueryOptions } from "@/queries/video-reaction";
import { watchedVideosQueryOptions } from "@/queries/video-watch";
import { useAuthStore } from "@/stores/auth-store";

const PREVIEW_LIMIT = 6;

export const Route = createFileRoute("/u/$username/videos/")({
  loader: async ({ context, params }) => {
    const videos = await context.queryClient.query({
      ...userVideosQueryOptions(params.username),
      staleTime: "static",
    });

    return { videos };
  },
  pendingComponent: VideosPagePending,
  component: UserVideosPage,
});

function VideosPagePending() {
  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Video library"
        description="Watch, revisit, and discover thoughtful moving images."
      />

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <div className="space-y-1">
            <div className="h-5 w-36 rounded bg-muted/60" />

            <div className="h-4 w-48 rounded bg-muted/40" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WatchedCardSkeleton index={0} />

            <WatchedCardSkeleton index={1} />

            <WatchedCardSkeleton index={2} />
          </div>
        </section>
      </div>
    </>
  );
}

function OwnerLibraryData({
  isOwner,
  username,
  videos,
}: {
  isOwner: boolean;
  username: string;
  videos: Array<UserVideoItem>;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const canFetchOwnerLists = isOwner && !isRestoring && accessToken != null && accessToken.length > 0;

  const watchedQuery = useQuery({
    ...watchedVideosQueryOptions({
      limit: PREVIEW_LIMIT,
      offset: 0,
    }),
    enabled: canFetchOwnerLists,
    placeholderData: keepPreviousData,
  });

  const likedQuery = useQuery({
    ...likedVideosQueryOptions({
      limit: PREVIEW_LIMIT,
      offset: 0,
    }),
    enabled: canFetchOwnerLists,
    placeholderData: keepPreviousData,
  });

  const playlistsQuery = useQuery({
    ...playlistsQueryOptions({
      limit: 50,
      offset: 0,
    }),
    enabled: canFetchOwnerLists,
    placeholderData: keepPreviousData,
  });

  const watchedVideos = isOwner ? (watchedQuery.data?.items ?? []).slice(0, PREVIEW_LIMIT) : [];
  const isWatchedLoading = isOwner && (isRestoring || (canFetchOwnerLists && watchedQuery.isPending));

  const likedVideos = isOwner ? (likedQuery.data?.items ?? []).slice(0, PREVIEW_LIMIT) : [];
  const isLikedLoading = isOwner && (isRestoring || (canFetchOwnerLists && likedQuery.isPending));

  const playlists = isOwner ? (playlistsQuery.data?.items ?? []) : [];
  const isPlaylistsLoading = isOwner && (isRestoring || (canFetchOwnerLists && playlistsQuery.isPending));

  return (
    <VideosPanel
      videos={videos}
      playlists={playlists}
      watchedVideos={watchedVideos}
      isWatchedLoading={isWatchedLoading}
      likedVideos={likedVideos}
      isLikedLoading={isLikedLoading}
      isPlaylistsLoading={isPlaylistsLoading}
      isOwner={isOwner}
      username={username}
    />
  );
}

function UserVideosPage() {
  const { username } = Route.useParams();
  const { videos } = Route.useLoaderData();
  const { isOwner } = useResolvedOwner(username);

  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Video library"
        description="Watch, revisit, and discover thoughtful moving images."
      />

      <Suspense
        fallback={
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <WatchedCardSkeleton index={0} />

                <WatchedCardSkeleton index={1} />

                <WatchedCardSkeleton index={2} />
              </div>
            </section>
          </div>
        }
      >
        <OwnerLibraryData isOwner={isOwner} username={username} videos={videos} />
      </Suspense>
    </>
  );
}
