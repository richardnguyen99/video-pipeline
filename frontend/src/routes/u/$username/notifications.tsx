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
  const { isOwner, authUser, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && authUser != null && authUser.username !== username) {
    return <Navigate to="/u/$username/notifications" params={{ username: authUser.username }} replace />;
  }

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return <NotificationsPanel />;
}
