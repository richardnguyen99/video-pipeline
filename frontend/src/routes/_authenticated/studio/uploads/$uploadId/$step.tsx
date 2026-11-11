import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { UploadStudio } from "@/layouts/studio/uploads/wizard";
import { UploadStudioSkeleton } from "@/layouts/studio/uploads/wizard-skeleton";

import { Route as UploadDetailRoute } from "./route";

const stepParamsSchema = z.object({
  step: z.coerce.number().int().min(1).max(7),
});

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/$step")({
  params: {
    parse: (raw) => ({
      uploadId: String(raw.uploadId),
      step: stepParamsSchema.parse({ step: raw.step }).step,
    }),
    stringify: ({ uploadId, step }) => ({
      uploadId,
      step: String(step),
    }),
  },
  ssr: true,
  pendingComponent: StudioUploadDetailPending,
  component: StudioUploadDetailPage,
});

function StudioUploadDetailPending() {
  const { step } = Route.useParams();

  return <UploadStudioSkeleton activeStep={step} />;
}

function StudioUploadDetailPage() {
  const { status } = UploadDetailRoute.useLoaderData();
  const { uploadId, step } = Route.useParams();

  return <UploadStudio key={uploadId} uploadId={uploadId} initialStatus={status} initialStep={step} />;
}
