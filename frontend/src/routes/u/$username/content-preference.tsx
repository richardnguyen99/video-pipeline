import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ContentPreferencePanel } from "@/layouts/user-profile/content-preference-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import {
  CONTENT_PREFERENCE_LOCALE,
  contentPreferenceQueryKeys,
  myContentPreferencesQueryOptions,
} from "@/queries/content-preference";
import type { ContentPreferenceListResponse } from "@/queries/content-preference";
import { fetchMyContentPreferencesServer } from "@/server/content-preference.functions";

export const Route = createFileRoute("/u/$username/content-preference")({
  beforeLoad: requireOwnerBeforeLoad,
  loader: async ({ context }) => {
    if (!context.auth.isReady || context.auth.user == null) {
      return { preferences: null as ContentPreferenceListResponse | null };
    }

    const locale = CONTENT_PREFERENCE_LOCALE;

    // SSR cannot use client apiFetch (no in-memory access token). Resolve via
    // refresh cookie on the server, then seed the query cache for hydration.
    if (typeof window === "undefined") {
      const preferences = await fetchMyContentPreferencesServer({
        data: { locale },
      });

      if (preferences != null) {
        context.queryClient.setQueryData(contentPreferenceQueryKeys.me(locale), preferences);
      }

      return { preferences };
    }

    try {
      const preferences = await context.queryClient.query({
        ...myContentPreferencesQueryOptions(locale),
        staleTime: "static",
      });

      return { preferences };
    } catch {
      return { preferences: null as ContentPreferenceListResponse | null };
    }
  },
  component: ContentPreferencePage,
});

function ContentPreferencePage() {
  const { username } = Route.useParams();
  const { preferences } = Route.useLoaderData();
  const { isOwner, authUser, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && authUser != null && authUser.username !== username) {
    return <Navigate to="/u/$username/content-preference" params={{ username: authUser.username }} replace />;
  }

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return <ContentPreferencePanel initialPreferences={preferences} />;
}
