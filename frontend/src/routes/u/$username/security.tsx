import { createFileRoute, redirect } from "@tanstack/react-router";

import { SecurityPanel } from "@/layouts/user-profile/security-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/u/$username/security")({
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
  component: UserSecurityPage,
});

function UserSecurityPage() {
  const { username } = Route.useParams();
  const { isOwner, user, isRestoring } = useUserSettingsContext(username);

  if (isRestoring || user == null || !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="security"
        title="Security"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <SecurityPanel user={user} />
    </>
  );
}
