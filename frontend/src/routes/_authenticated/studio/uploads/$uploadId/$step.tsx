import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { UploadStudio } from "@/layouts/video/studio/upload-studio";
import { UploadStudioSkeleton } from "@/layouts/video/studio/upload-studio-skeleton";
import { videoUploadStatusQueryKey, videoUploadStatusQueryOptions } from "@/queries/video-upload";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";
import { fetchVideoUploadStatusServer } from "@/server/video-upload.functions";

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
  loader: async ({ context, params }): Promise<{ status: VideoUploadStatusResponse | null }> => {
    const uploadId = params.uploadId;
    const cached = context.queryClient.getQueryData<VideoUploadStatusResponse>(videoUploadStatusQueryKey(uploadId));

    if (cached != null) {
      return { status: cached };
    }

    if (typeof window === "undefined") {
      const status = await fetchVideoUploadStatusServer({
        data: { publicId: uploadId },
      });

      if (status != null) {
        context.queryClient.setQueryData(videoUploadStatusQueryKey(uploadId), status);
      }

      return { status };
    }

    if (!context.auth.isReady || context.auth.user == null) {
      return { status: null };
    }

    try {
      const status = await context.queryClient.query({
        ...videoUploadStatusQueryOptions(uploadId),
        staleTime: 30_000,
      });

      return { status };
    } catch {
      return { status: null };
    }
  },
  pendingComponent: StudioUploadDetailPending,
  component: StudioUploadDetailPage,
});

function StudioUploadDetailPending() {
  const { step } = Route.useParams();

  return <UploadStudioSkeleton activeStep={step} />;
}

function StudioUploadDetailPage() {
  const { status } = Route.useLoaderData();
  const { uploadId, step } = Route.useParams();

  return <UploadStudio key={uploadId} uploadId={uploadId} initialStatus={status} initialStep={step} />;
}
