import { createServerFn } from "@tanstack/react-start";

import type { ContentPreferenceListResponse } from "@/queries/content-preference";
import { CONTENT_PREFERENCE_LOCALE } from "@/queries/content-preference";

/**
 * Resolve content preferences on the server using the refresh cookie
 * (or a Bearer token already obtained earlier in the same SSR request).
 * Seeds the dehydrated query cache so the settings page does not flash
 * empty / error on hard refresh.
 *
 * Cookie / token resolution lives in ``content-preference.impl.server`` so
 * this module stays free of ``@tanstack/react-start/server`` imports.
 */
export const fetchMyContentPreferencesServer = createServerFn({
  method: "POST",
})
  .validator((data: { locale?: string } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ContentPreferenceListResponse | null> => {
    const { resolveMyContentPreferences } = await import("./content-preference.impl.server");

    return resolveMyContentPreferences(data.locale ?? CONTENT_PREFERENCE_LOCALE);
  });
