import { createFileRoute } from "@tanstack/react-router";

import { StudioShell } from "@/layouts/video/studio/studio-shell";

export const Route = createFileRoute("/_authenticated/studio")({
  component: StudioShell,
});
