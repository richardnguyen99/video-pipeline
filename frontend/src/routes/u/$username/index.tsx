import { createFileRoute } from "@tanstack/react-router";

import { ProfilePanel } from "@/layouts/user-profile/profile-panel";
import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { publicUserProfileQueryOptions } from "@/queries/user-profile";

export const Route = createFileRoute("/u/$username/")({
  loader: async ({ context, params }) => {
    const profile = await context.queryClient.ensureQueryData(publicUserProfileQueryOptions(params.username));

    return { profile };
  },
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const { profile } = Route.useLoaderData();
  const { isOwner, authUser } = useResolvedOwner(username);

  return (
    <>
      <SettingsContentHeader
        active="profile"
        title={isOwner ? "Your public profile" : "A public profile"}
        description={
          isOwner
            ? "Fine-tune your experience and keep your account feeling like yours."
            : "Only information this user has chosen to share publicly is shown here."
        }
      />

      <ProfilePanel profile={profile} isOwner={isOwner} authUser={authUser} />
    </>
  );
}
