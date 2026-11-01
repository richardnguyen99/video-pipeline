import { createFileRoute } from "@tanstack/react-router";

import { UploadStudio } from "@/layouts/video/studio/upload-studio";

export const Route = createFileRoute("/_authenticated/studio/uploads/new")({
  ssr: true,
  component: StudioNewUploadPage,
});

function StudioNewUploadPage() {
  return <UploadStudio key="new" />;
}
