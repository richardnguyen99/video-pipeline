import { createFileRoute } from "@tanstack/react-router";

import { StudioErrorPage, StudioNotFoundPage } from "@/components/studio/studio-error-page";
import { StudioShell } from "@/layouts/studio/shell";

export const Route = createFileRoute("/_authenticated/studio")({
  ssr: true,
  component: StudioShell,
  errorComponent: StudioErrorPage,
  notFoundComponent: StudioNotFoundPage,
});
