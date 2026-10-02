import { createFileRoute } from "@tanstack/react-router";

import { ProfilePanel } from "@/layouts/user-profile/profile-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const { isOwner, user, profile, profileQuery } = useUserSettingsContext(username);

  if (profileQuery.isLoading || profile == null) {
    return <SettingsContentSkeleton />;
  }

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

      <ProfilePanel profile={profile} isOwner={isOwner} authUser={user} />
    </>
  );
}
