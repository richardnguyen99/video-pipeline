import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { useOwnerPlaylists, useOwnerVideos, useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";
import { VideosPanel } from "@/layouts/user-profile/videos-panel";

export const Route = createFileRoute("/u/$username/videos")({
  component: UserVideosPage,
});

function UserVideosPage() {
  const { username } = Route.useParams();
  const { isOwner } = useUserSettingsContext(username);
  const videosQuery = useOwnerVideos(username);
  const playlistsQuery = useOwnerPlaylists(username);

  if (videosQuery.isLoading || playlistsQuery.isLoading) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Video library"
        description="Watch, revisit, and discover thoughtful moving images."
      />

      <VideosPanel videos={videosQuery.data ?? []} playlists={playlistsQuery.data ?? []} isOwner={isOwner} />
    </>
  );
}
