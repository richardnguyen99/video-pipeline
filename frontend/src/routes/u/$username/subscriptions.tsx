import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { useOwnerFollowed, useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";
import { SubscriptionsPanel } from "@/layouts/user-profile/subscriptions-panel";

export const Route = createFileRoute("/u/$username/subscriptions")({
  component: UserSubscriptionsPage,
});

function UserSubscriptionsPage() {
  const { username } = Route.useParams();
  const { isOwner } = useUserSettingsContext(username);
  const followedQuery = useOwnerFollowed(username);

  if (followedQuery.isLoading) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="subscriptions"
        title="Subscriptions"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <SubscriptionsPanel creators={followedQuery.data ?? []} isOwner={isOwner} />
    </>
  );
}
