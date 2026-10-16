import { createServerFn } from "@tanstack/react-start";

import type { PrivacySettings } from "@/queries/privacy-settings";

/**
 * Resolve privacy settings on the server using the refresh cookie
 * (or a Bearer token already obtained earlier in the same SSR request).
 * Seeds the dehydrated query cache so the settings page does not flash
 * a loading state on hard refresh.
 */
export const fetchMyPrivacySettingsServer = createServerFn({
  method: "POST",
}).handler(async (): Promise<PrivacySettings | null> => {
  const { resolveMyPrivacySettings } = await import("./privacy-settings.impl.server");

  return resolveMyPrivacySettings();
});
