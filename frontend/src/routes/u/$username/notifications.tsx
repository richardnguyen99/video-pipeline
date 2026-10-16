import { createFileRoute, Navigate } from "@tanstack/react-router";

import { NotificationsPanel } from "@/layouts/user-profile/notifications-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { myNotificationSettingsQueryOptions, notificationSettingsQueryKeys } from "@/queries/notification-settings";
import type { NotificationSettings } from "@/queries/notification-settings";
import { fetchMyNotificationSettingsServer } from "@/server/notification-settings.functions";

export const Route = createFileRoute("/u/$username/notifications")({
  beforeLoad: requireOwnerBeforeLoad,
  loader: async ({ context }) => {
    const cached = context.queryClient.getQueryData<NotificationSettings>(notificationSettingsQueryKeys.me());

    if (cached != null) {
      return { settings: cached };
    }

    if (typeof window === "undefined") {
      const settings = await fetchMyNotificationSettingsServer();

      if (settings != null) {
        context.queryClient.setQueryData(notificationSettingsQueryKeys.me(), settings);
      }

      return { settings };
    }

    if (!context.auth.isReady || context.auth.user == null) {
      return { settings: null as NotificationSettings | null };
    }

    try {
      const settings = await context.queryClient.query({
        ...myNotificationSettingsQueryOptions(),
        staleTime: "static",
      });

      return { settings };
    } catch {
      return { settings: null as NotificationSettings | null };
    }
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { username } = Route.useParams();
  const { settings } = Route.useLoaderData();
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

  return <NotificationsPanel initialSettings={settings} />;
}
