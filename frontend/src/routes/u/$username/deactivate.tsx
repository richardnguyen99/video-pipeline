import { createFileRoute, redirect } from "@tanstack/react-router";

import { DeactivatePanel } from "@/layouts/user-profile/deactivate-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/deactivate")({
  beforeLoad: ({ params }) => {
    if (typeof window === "undefined") {
      return;
    }

    const { user, isRestoring } = useAuthStore.getState();

    if (isRestoring) {
      return;
    }

    if (user == null || user.username !== params.username) {
      throw redirect({
        to: "/u/$username",
        params: { username: params.username },
      });
    }
  },
  component: DeactivatePage,
});

function DeactivatePage() {
  const { username } = Route.useParams();
  const { isOwner, isRestoring } = useUserSettingsContext(username);

  if (isRestoring || !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="deactivate"
        title="Deactivate account"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <DeactivatePanel />
    </>
  );
}
