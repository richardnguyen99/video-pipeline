import { createFileRoute, redirect } from "@tanstack/react-router";

import { defaultStepForStatus } from "@/layouts/video/studio/session-persist";
import { videoUploadStatusQueryKey, videoUploadStatusQueryOptions } from "@/queries/video-upload";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";
import { fetchVideoUploadStatusServer } from "@/server/video-upload.functions";

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/")({
  ssr: true,
  loader: async ({ context, params }) => {
    const uploadId = params.uploadId;
    let status =
      context.queryClient.getQueryData<VideoUploadStatusResponse>(videoUploadStatusQueryKey(uploadId)) ?? null;

    if (status == null) {
      if (typeof window === "undefined") {
        status = await fetchVideoUploadStatusServer({
          data: { publicId: uploadId },
        });
      } else if (context.auth.isReady && context.auth.user != null) {
        try {
          status = await context.queryClient.query({
            ...videoUploadStatusQueryOptions(uploadId),
            staleTime: 30_000,
          });
        } catch {
          status = null;
        }
      }
    }

    if (status != null) {
      context.queryClient.setQueryData(videoUploadStatusQueryKey(uploadId), status);
    }

    const step = status != null ? defaultStepForStatus(status) : 1;

    throw redirect({
      to: "/studio/uploads/$uploadId/$step",
      params: {
        uploadId,
        step: String(Math.min(7, Math.max(1, step))),
      },
      replace: true,
    });
  },
});
