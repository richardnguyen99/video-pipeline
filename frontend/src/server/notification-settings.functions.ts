import { createServerFn } from "@tanstack/react-start";

import type { NotificationSettings } from "@/queries/notification-settings";

/**
 * Resolve notification settings on the server using the refresh cookie
 * (or a Bearer token already obtained earlier in the same SSR request).
 * Seeds the dehydrated query cache so the settings page does not flash
 * a loading state on hard refresh.
 *
 * Cookie / token resolution lives in ``notification-settings.impl.server``
 * so this module stays free of ``@tanstack/react-start/server`` imports.
 */
export const fetchMyNotificationSettingsServer = createServerFn({
  method: "POST",
}).handler(async (): Promise<NotificationSettings | null> => {
  const { resolveMyNotificationSettings } = await import("./notification-settings.impl.server");

  return resolveMyNotificationSettings();
});
