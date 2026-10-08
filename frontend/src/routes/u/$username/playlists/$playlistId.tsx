import { createFileRoute, redirect } from "@tanstack/react-router";

import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { PlaylistDetailPage } from "@/layouts/user-profile/videos/playlist-detail-page";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/playlists/$playlistId")({
  beforeLoad: ({ context, params }) => {
    const auth = context.auth;
    const isOwner = auth.isReady && auth.isAuthenticated && auth.user != null && auth.user.username === params.username;

    if (auth.isReady && !isOwner) {
      throw redirect({
        to: "/u/$username/videos",
        params: { username: params.username },
      });
    }
  },
  component: PlaylistDetailRoute,
});

function PlaylistDetailRoute() {
  const { username, playlistId } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const enabled = isOwner && !isRestoring && accessToken != null && accessToken.length > 0;

  return (
    <>
      <SettingsContentHeader active="videos" title="Playlist" description="Videos saved in this playlist." />

      <PlaylistDetailPage playlistId={playlistId} enabled={enabled} isOwner={isOwner} />
    </>
  );
}
