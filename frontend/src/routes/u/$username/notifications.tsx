import { createFileRoute, Navigate } from "@tanstack/react-router";

import { NotificationsPanel } from "@/layouts/user-profile/notifications-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/notifications")({
  beforeLoad: requireOwnerBeforeLoad,
  component: NotificationsPage,
});

function NotificationsPage() {
  const { username } = Route.useParams();
  const { isOwner, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return <NotificationsPanel />;
}
