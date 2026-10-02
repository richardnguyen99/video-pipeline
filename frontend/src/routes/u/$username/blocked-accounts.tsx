import { createFileRoute, redirect } from "@tanstack/react-router";

import { BlockedAccountsPanel } from "@/layouts/user-profile/blocked-accounts-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { useOwnerBlocked, useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/blocked-accounts")({
  beforeLoad: ({ params }) => {
    if (typeof window === "undefined") {
      return;
    }

    const { user, isRestoring } = useAuthStore.getState();

    if (isRestoring) {
      return;
    }

    if (user == null || user.username !== params.username) {
      throw redirect({
        to: "/u/$username",
        params: { username: params.username },
      });
    }
  },
  component: BlockedAccountsPage,
});

function BlockedAccountsPage() {
  const { username } = Route.useParams();
  const { isOwner, isRestoring } = useUserSettingsContext(username);
  const blockedQuery = useOwnerBlocked(username);

  if (isRestoring || !isOwner || blockedQuery.isLoading) {
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
