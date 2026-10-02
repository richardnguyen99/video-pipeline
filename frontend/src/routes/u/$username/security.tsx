import { createFileRoute } from "@tanstack/react-router";

import { SecurityPanel } from "@/layouts/user-profile/security-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/security")({
  beforeLoad: requireOwnerBeforeLoad,
  component: UserSecurityPage,
});

function UserSecurityPage() {
  const { username } = Route.useParams();
  const { isOwner, authUser } = useResolvedOwner(username);

  if (!isOwner || authUser == null) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="security"
        title="Security"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <SecurityPanel user={authUser} />
    </>
  );
}
