import { createFileRoute } from "@tanstack/react-router";

import { SubscriptionsPanel } from "@/layouts/user-profile/subscriptions/panel";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { userActressSubscriptionsQueryOptions } from "@/queries/actress-subscribe";

export const Route = createFileRoute("/u/$username/subscriptions")({
  loader: async ({ context, params }) => {
    const subscriptions = await context.queryClient.query({
      ...userActressSubscriptionsQueryOptions(params.username),
      staleTime: "static",
    });

    return { subscriptions };
  },
  component: UserSubscriptionsPage,
});

function UserSubscriptionsPage() {
  const { username } = Route.useParams();
  const { subscriptions } = Route.useLoaderData();
  const { isOwner } = useResolvedOwner(username);

  return <SubscriptionsPanel username={username} subscriptions={subscriptions} isOwner={isOwner} />;
}
