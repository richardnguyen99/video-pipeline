import { createFileRoute } from "@tanstack/react-router";

import { Panel as ProfilePanel } from "@/layouts/user-profile/profile";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { publicUserBioQueryOptions } from "@/queries/user-bio";
import { publicUserProfileQueryOptions } from "@/queries/user-profile";

export const Route = createFileRoute("/u/$username/")({
  loader: async ({ context, params }) => {
    const [profile] = await Promise.all([
      context.queryClient.query({
        ...publicUserProfileQueryOptions(params.username),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...publicUserBioQueryOptions(params.username),
        staleTime: "static",
      }),
    ]);

    return { profile };
  },
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const { profile } = Route.useLoaderData();
  const { isOwner, authUser } = useResolvedOwner(username);

  return <ProfilePanel profile={profile} isOwner={isOwner} authUser={authUser} />;
}
