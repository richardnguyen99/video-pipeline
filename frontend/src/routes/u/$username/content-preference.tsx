import { createFileRoute } from "@tanstack/react-router";

import { SettingsContentHeader, SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { TagEditor } from "@/layouts/user-profile/tag-editor";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/content-preference")({
  beforeLoad: requireOwnerBeforeLoad,
  component: ContentPreferencePage,
});

function ContentPreferencePage() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);

  if (!isOwner) {
    return <SettingsContentSkeleton />;
  }

  return (
    <>
      <SettingsContentHeader
        active="content-preference"
        title="Content preference"
        description="Fine-tune your experience and keep your account feeling like yours."
      />

      <div className="flex flex-col gap-4">
        <TagEditor
          label="Interests"
          description="Tell Velvet what you enjoy so your recommendations feel more personal."
          initialTags={["Documentaries", "Street photography", "Independent cinema"]}
        />

        <TagEditor
          label="Dislikes"
          description="Add topics you would rather see less often in your recommendations."
          initialTags={["Spoilers", "Loud jump cuts"]}
        />
      </div>
    </>
  );
}
