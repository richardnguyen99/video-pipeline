import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { Panel as VideosPanel } from "@/layouts/user-profile/videos";
import { userPlaylistsQueryOptions, userVideosQueryOptions } from "@/queries/user-profile";
import { likedVideosQueryOptions } from "@/queries/video-reaction";
import { watchedVideosQueryOptions } from "@/queries/video-watch";
import { useAuthStore } from "@/stores/auth-store";

const PREVIEW_LIMIT = 6;

function noop(): void {
  return;
}

export const Route = createFileRoute("/u/$username/videos/")({
  loader: async ({ context, params }) => {
    const [videos, playlists] = await Promise.all([
      context.queryClient.query({
        ...userVideosQueryOptions(params.username),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...userPlaylistsQueryOptions(params.username),
        staleTime: "static",
      }),
    ]);

    const accessToken = useAuthStore.getState().accessToken;

    if (typeof window !== "undefined" && accessToken != null && accessToken.length > 0) {
      await Promise.all([
        context.queryClient
          .query(
            watchedVideosQueryOptions({
              limit: PREVIEW_LIMIT,
              offset: 0,
            }),
          )
          .catch(noop),
        context.queryClient
          .query(
            likedVideosQueryOptions({
              limit: PREVIEW_LIMIT,
              offset: 0,
            }),
          )
          .catch(noop),
      ]);
    }

    return { videos, playlists };
  },
  component: UserVideosPage,
});

function UserVideosPage() {
  const { username } = Route.useParams();
  const { videos, playlists } = Route.useLoaderData();
  const { isOwner } = useResolvedOwner(username);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const canFetchOwnerLists = isOwner && !isRestoring && accessToken != null && accessToken.length > 0;

  const watchedQuery = useQuery({
    ...watchedVideosQueryOptions({
      limit: PREVIEW_LIMIT,
      offset: 0,
    }),
    enabled: canFetchOwnerLists,
  });

  const likedQuery = useQuery({
    ...likedVideosQueryOptions({
      limit: PREVIEW_LIMIT,
      offset: 0,
    }),
    enabled: canFetchOwnerLists,
  });

  const watchedVideos = isOwner ? (watchedQuery.data?.items ?? []).slice(0, PREVIEW_LIMIT) : [];
  const isWatchedLoading = isOwner && (isRestoring || (canFetchOwnerLists && watchedQuery.isPending));

  const likedVideos = isOwner ? (likedQuery.data?.items ?? []).slice(0, PREVIEW_LIMIT) : [];
  const isLikedLoading = isOwner && (isRestoring || (canFetchOwnerLists && likedQuery.isPending));

  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Video library"
        description="Watch, revisit, and discover thoughtful moving images."
      />

      <VideosPanel
        videos={videos}
        playlists={playlists}
        watchedVideos={watchedVideos}
        isWatchedLoading={isWatchedLoading}
        likedVideos={likedVideos}
        isLikedLoading={isLikedLoading}
        isOwner={isOwner}
        username={username}
      />
    </>
  );
}
