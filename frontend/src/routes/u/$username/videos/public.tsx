import { createFileRoute } from "@tanstack/react-router";

import { PublicUploadsPage } from "@/layouts/user-profile/videos/public-uploads-page";
import { SettingsContentHeader } from "@/layouts/user-profile/settings-shell";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";

export const Route = createFileRoute("/u/$username/videos/public")({
  component: PublicVideosRoute,
});

function PublicVideosRoute() {
  const { username } = Route.useParams();
  const { isOwner } = useResolvedOwner(username);

  return (
    <>
      <SettingsContentHeader
        active="videos"
        title="Public uploaded videos"
        description={
          isOwner
            ? "Everything you have shared publicly, newest first."
            : "Public uploads from this profile, newest first."
        }
      />

      <PublicUploadsPage username={username} isOwner={isOwner} />
    </>
  );
}
