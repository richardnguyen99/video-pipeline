import { createFileRoute, redirect } from "@tanstack/react-router";

import { HistoryPage } from "@/layouts/user-profile/videos/history-page";
import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/videos/history")({
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
  component: WatchHistoryRoute,
});

function WatchHistoryRoute() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const enabled = isOwner && !isRestoring && accessToken != null && accessToken.length > 0;

  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Watch history"
        description="Everything you have watched, newest first."
      />

      <HistoryPage enabled={enabled} />
    </>
  );
}
