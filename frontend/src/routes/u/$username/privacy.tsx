import { createFileRoute, Navigate } from "@tanstack/react-router";

import { PrivacyPanel } from "@/layouts/user-profile/privacy-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { myPrivacySettingsQueryOptions, privacySettingsQueryKeys } from "@/queries/privacy-settings";
import type { PrivacySettings } from "@/queries/privacy-settings";
import { fetchMyPrivacySettingsServer } from "@/server/privacy-settings.functions";

export const Route = createFileRoute("/u/$username/privacy")({
  beforeLoad: requireOwnerBeforeLoad,
  loader: async ({ context }) => {
    const cached = context.queryClient.getQueryData<PrivacySettings>(privacySettingsQueryKeys.me());

    if (cached != null) {
      return { settings: cached };
    }

    if (typeof window === "undefined") {
      const settings = await fetchMyPrivacySettingsServer();

      if (settings != null) {
        context.queryClient.setQueryData(privacySettingsQueryKeys.me(), settings);
      }

      return { settings };
    }

    if (!context.auth.isReady || context.auth.user == null) {
      return { settings: null as PrivacySettings | null };
    }

    try {
      const settings = await context.queryClient.query({
        ...myPrivacySettingsQueryOptions(),
        staleTime: "static",
      });

      return { settings };
    } catch {
      return { settings: null as PrivacySettings | null };
    }
  },
  component: PrivacyPage,
});

function PrivacyPage() {
  const { username } = Route.useParams();
  const { settings } = Route.useLoaderData();
  const { isOwner, authUser, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && authUser != null && authUser.username !== username) {
    return <Navigate to="/u/$username/privacy" params={{ username: authUser.username }} replace />;
  }

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return <PrivacyPanel initialSettings={settings} />;
}
