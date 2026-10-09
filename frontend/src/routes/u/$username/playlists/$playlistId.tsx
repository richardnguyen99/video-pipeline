import { createFileRoute } from "@tanstack/react-router";

import { PlaylistDetailPage } from "@/layouts/user-profile/playlists/detail-page";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/playlists/$playlistId")({
  component: PlaylistDetailRoute,
});

function PlaylistDetailRoute() {
  const { username, playlistId } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const enabled = isOwner ? !isRestoring && accessToken != null && accessToken.length > 0 : !isRestoring;

  return <PlaylistDetailPage playlistId={playlistId} enabled={enabled} isOwner={isOwner} username={username} />;
}
