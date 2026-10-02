import { createFileRoute, redirect } from "@tanstack/react-router";

import { NotificationsPanel } from "@/layouts/user-profile/notifications-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/notifications")({
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
  component: NotificationsPage,
});

function NotificationsPage() {
  const { username } = Route.useParams();
  const { isOwner, isRestoring } = useUserSettingsContext(username);

  if (isRestoring || !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="notifications"
        title="Notifications"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <NotificationsPanel />
    </>
  );
}
