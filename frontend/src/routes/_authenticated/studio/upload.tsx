import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { UploadStudio } from "@/layouts/video/studio/upload-studio";
import { UploadStudioSkeleton } from "@/layouts/video/studio/upload-studio-skeleton";
import { videoUploadStatusQueryKey, videoUploadStatusQueryOptions } from "@/queries/video-upload";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";
import { fetchVideoUploadStatusServer } from "@/server/video-upload.functions";

const studioUploadSearchSchema = z.object({
  publicId: z.uuid().optional().catch(undefined),
  step: z.coerce.number().int().min(1).max(7).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/studio/upload")({
  validateSearch: studioUploadSearchSchema,
  ssr: true,
  loaderDeps: ({ search }) => ({ publicId: search.publicId }),
  loader: async ({ context, deps }): Promise<{ status: VideoUploadStatusResponse | null }> => {
    if (deps.publicId == null) {
      return { status: null };
    }

    const cached = context.queryClient.getQueryData<VideoUploadStatusResponse>(
      videoUploadStatusQueryKey(deps.publicId),
    );

    if (cached != null) {
      return { status: cached };
    }

    if (typeof window === "undefined") {
      const status = await fetchVideoUploadStatusServer({
        data: { publicId: deps.publicId },
      });

      if (status != null) {
        context.queryClient.setQueryData(videoUploadStatusQueryKey(deps.publicId), status);
      }

      return { status };
    }

    if (!context.auth.isReady || context.auth.user == null) {
      return { status: null };
    }

    try {
      const status = await context.queryClient.query({
        ...videoUploadStatusQueryOptions(deps.publicId),
        staleTime: 30_000,
      });

      return { status };
    } catch {
      return { status: null };
    }
  },
  pendingComponent: StudioUploadPending,
  component: StudioUploadPage,
});

function StudioUploadPending() {
  const search = Route.useSearch();

  return <UploadStudioSkeleton activeStep={search.step ?? 7} />;
}

function StudioUploadPage() {
  const { status } = Route.useLoaderData();
  const search = Route.useSearch();

  return <UploadStudio key={search.publicId ?? "new"} initialStatus={status} initialStep={search.step} />;
}
