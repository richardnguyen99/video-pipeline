import { createFileRoute, Navigate } from "@tanstack/react-router";

import { DeactivatePanel } from "@/layouts/user-profile/deactivate-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/deactivate")({
  beforeLoad: requireOwnerBeforeLoad,
  component: DeactivatePage,
});

function DeactivatePage() {
  const { username } = Route.useParams();
  const { isOwner, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return <DeactivatePanel />;
}
