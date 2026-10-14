import { createFileRoute, Navigate } from "@tanstack/react-router";

import { SecurityPanel } from "@/layouts/user-profile/security";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/security")({
  beforeLoad: requireOwnerBeforeLoad,
  component: UserSecurityPage,
});

function UserSecurityPage() {
  const { username } = Route.useParams();
  const { isOwner, authUser, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && (!isOwner || authUser == null)) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  if (authUser == null) {
    return <SettingsContentSkeleton />;
  }

  return <SecurityPanel user={authUser} />;
}
