import { createFileRoute } from "@tanstack/react-router";

import { UploadMediaEditor, UploadMediaEditorSkeleton } from "@/layouts/studio/uploads/media-editor";
import { videoUploadStatusQueryKey, videoUploadStatusQueryOptions } from "@/queries/video-upload";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";
import { fetchVideoUploadStatusServer } from "@/server/video-upload.functions";

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/media")({
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
  pendingComponent: UploadMediaPending,
  component: UploadMediaPage,
});

function UploadMediaPending() {
  return <UploadMediaEditorSkeleton />;
}

function UploadMediaPage() {
  const { status } = Route.useLoaderData();
  const { uploadId } = Route.useParams();

  return <UploadMediaEditor key={uploadId} uploadId={uploadId} initialStatus={status} />;
}
