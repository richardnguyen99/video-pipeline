import { createFileRoute } from "@tanstack/react-router";

import { StudioDashboard } from "@/layouts/video/studio/studio-dashboard";

export const Route = createFileRoute("/_authenticated/studio/")({
  component: StudioPage,
});

function StudioPage() {
  return <StudioDashboard />;
}
