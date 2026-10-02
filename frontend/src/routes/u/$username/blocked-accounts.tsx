import { createFileRoute } from "@tanstack/react-router";

import { BlockedAccountsPanel } from "@/layouts/user-profile/blocked-accounts-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useOwnerBlocked, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/blocked-accounts")({
  beforeLoad: requireOwnerBeforeLoad,
  component: BlockedAccountsPage,
});

function BlockedAccountsPage() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);
  const blockedQuery = useOwnerBlocked(username);

  if (!isOwner || blockedQuery.isPending) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="blocked-accounts"
        title="Blocked accounts"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <BlockedAccountsPanel username={username} accounts={blockedQuery.data ?? []} />
    </>
  );
}
