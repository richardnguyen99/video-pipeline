import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPanel } from "@/layouts/user-profile/notifications-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/notifications")({
  beforeLoad: requireOwnerBeforeLoad,
  component: NotificationsPage,
});

function NotificationsPage() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);

  if (!isOwner) {
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
