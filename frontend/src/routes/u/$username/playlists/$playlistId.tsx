import { createFileRoute } from "@tanstack/react-router";

import { PlaylistDetailPage } from "@/layouts/user-profile/playlists/detail-page";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/playlists/$playlistId")({
  component: PlaylistDetailRoute,
});

function PlaylistDetailRoute() {
  const { username, playlistId } = Route.useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const authUserId = useAuthStore((state) => state.user?.id ?? null);

  const enabled = !isRestoring && (authUserId == null || (accessToken != null && accessToken.length > 0));

  return <PlaylistDetailPage playlistId={playlistId} enabled={enabled} username={username} />;
}
