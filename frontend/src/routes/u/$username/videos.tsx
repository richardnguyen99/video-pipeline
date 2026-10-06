import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { VideosPanel } from "@/layouts/user-profile/videos-panel";
import { userPlaylistsQueryOptions, userVideosQueryOptions } from "@/queries/user-profile";
import { watchedVideosQueryOptions } from "@/queries/video-watch";
import { useAuthStore } from "@/stores/auth-store";

const WATCHED_PREVIEW_LIMIT = 12;

function noop(): void {
  return;
}

export const Route = createFileRoute("/u/$username/videos")({
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

    // Prefetch watched history only when the browser already has a bearer
    // token. SSR / hard-refresh before silent-refresh must not cache an empty
    // failure as the source of truth.
    const accessToken = useAuthStore.getState().accessToken;

    if (typeof window !== "undefined" && accessToken != null && accessToken.length > 0) {
      await context.queryClient
        .query(
          watchedVideosQueryOptions({
            limit: WATCHED_PREVIEW_LIMIT,
            offset: 0,
          }),
        )
        .catch(noop);
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

  const canFetchWatched = isOwner && !isRestoring && accessToken != null && accessToken.length > 0;

  const watchedQuery = useQuery({
    ...watchedVideosQueryOptions({
      limit: WATCHED_PREVIEW_LIMIT,
      offset: 0,
    }),
    enabled: canFetchWatched,
  });

  const watchedVideos = isOwner ? (watchedQuery.data?.items ?? []) : [];
  const isWatchedLoading = isOwner && (isRestoring || (canFetchWatched && watchedQuery.isPending));

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
        isOwner={isOwner}
      />
    </>
  );
}
