import { createFileRoute } from "@tanstack/react-router";

import { StudioShell } from "@/layouts/studio/shell";

export const Route = createFileRoute("/_authenticated/studio")({
  ssr: true,
  component: StudioShell,
});
