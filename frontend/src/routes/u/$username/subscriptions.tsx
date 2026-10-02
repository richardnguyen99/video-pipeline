import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { SubscriptionsPanel } from "@/layouts/user-profile/subscriptions-panel";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { userFollowedCreatorsQueryOptions } from "@/queries/user-profile";

export const Route = createFileRoute("/u/$username/subscriptions")({
  loader: async ({ context, params }) => {
    const creators = await context.queryClient.query({
      ...userFollowedCreatorsQueryOptions(params.username),
      staleTime: "static",
    });

    return { creators };
  },
  component: UserSubscriptionsPage,
});

function UserSubscriptionsPage() {
  const { username } = Route.useParams();
  const { creators } = Route.useLoaderData();
  const { isOwner } = useResolvedOwner(username);

  return (
    <>
      <SettingsContentHeader
        active="subscriptions"
        title="Subscriptions"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <SubscriptionsPanel creators={creators} isOwner={isOwner} />
    </>
  );
}
