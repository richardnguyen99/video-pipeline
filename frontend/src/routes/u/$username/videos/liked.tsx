import { createFileRoute, redirect } from "@tanstack/react-router";

import { LikedPage } from "@/layouts/user-profile/videos/liked-page";
import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/videos/liked")({
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
  component: LikedVideosRoute,
});

function LikedVideosRoute() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const enabled = isOwner && !isRestoring && accessToken != null && accessToken.length > 0;

  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Liked videos"
        description="Everything you have liked, newest first."
      />

      <LikedPage enabled={enabled} />
    </>
  );
}
