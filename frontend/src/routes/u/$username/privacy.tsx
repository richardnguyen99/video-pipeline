import { createFileRoute, Navigate } from "@tanstack/react-router";

import { PrivacyPanel } from "@/layouts/user-profile/privacy-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/privacy")({
  beforeLoad: requireOwnerBeforeLoad,
  component: PrivacyPage,
});

function PrivacyPage() {
  const { username } = Route.useParams();
  const { isOwner, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return <PrivacyPanel />;
}
