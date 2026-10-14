import { createFileRoute, Navigate } from "@tanstack/react-router";

import { BlockedAccountsPanel } from "@/layouts/user-profile/blocked-accounts-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useOwnerBlocked, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/blocked-accounts")({
  beforeLoad: requireOwnerBeforeLoad,
  component: BlockedAccountsPage,
});

function BlockedAccountsPage() {
  const { username } = Route.useParams();
  const { isOwner, isRestoring } = useResolvedOwner(username);
  const blockedQuery = useOwnerBlocked(username);

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  if (blockedQuery.isPending) {
    return <SettingsContentSkeleton />;
  }

  return <BlockedAccountsPanel username={username} accounts={blockedQuery.data ?? []} />;
}
