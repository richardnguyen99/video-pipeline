import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { VideosPanel } from "@/layouts/user-profile/videos-panel";
import { userPlaylistsQueryOptions, userVideosQueryOptions } from "@/queries/user-profile";

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

    return { videos, playlists };
  },
  component: UserVideosPage,
});

function UserVideosPage() {
  const { username } = Route.useParams();
  const { videos, playlists } = Route.useLoaderData();
  const { isOwner } = useResolvedOwner(username);

  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Video library"
        description="Watch, revisit, and discover thoughtful moving images."
      />

      <VideosPanel videos={videos} playlists={playlists} isOwner={isOwner} />
    </>
  );
}
