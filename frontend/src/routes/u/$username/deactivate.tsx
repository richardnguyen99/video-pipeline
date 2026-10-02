import { createFileRoute } from "@tanstack/react-router";

import { DeactivatePanel } from "@/layouts/user-profile/deactivate-panel";
import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/deactivate")({
  beforeLoad: requireOwnerBeforeLoad,
  component: DeactivatePage,
});

function DeactivatePage() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);

  if (!isOwner) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="deactivate"
        title="Deactivate account"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <DeactivatePanel />
    </>
  );
}
