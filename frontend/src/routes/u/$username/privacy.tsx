import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPanel } from "@/layouts/user-profile/privacy-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/privacy")({
  beforeLoad: requireOwnerBeforeLoad,
  component: PrivacyPage,
});

function PrivacyPage() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);

  if (!isOwner) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="privacy"
        title="Privacy"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <PrivacyPanel />
    </>
  );
}
