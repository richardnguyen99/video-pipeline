import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { UploadStudio } from "@/layouts/video/studio/upload-studio";

const studioUploadSearchSchema = z.object({
  publicId: z.uuid().optional().catch(undefined),
  step: z.coerce.number().int().min(1).max(7).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/studio/upload")({
  validateSearch: studioUploadSearchSchema,
  component: StudioUploadPage,
});

function StudioUploadPage() {
  return <UploadStudio />;
}
