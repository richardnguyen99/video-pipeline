import { createFileRoute } from "@tanstack/react-router";

import { UploadStudio } from "@/components/video/studio/upload-studio";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  return <UploadStudio />;
}
