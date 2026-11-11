import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { UploadNotFound } from "@/components/studio/upload-not-found";
import {
  markVideoUploadStatusUnavailable,
  videoUploadStatusQueryKey,
  videoUploadStatusQueryOptions,
} from "@/queries/video-upload";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";
import { fetchVideoUploadStatusServer } from "@/server/video-upload.functions";

export type UploadDetailLoaderData = {
  status: VideoUploadStatusResponse;
  accessible: true;
};

type AuthContext = {
  isReady: boolean;
  user: { id: string } | null;
};

type LoaderContext = {
  queryClient: QueryClient;
  auth: AuthContext;
};

async function loadUploadDetailStatus(context: LoaderContext, uploadId: string): Promise<UploadDetailLoaderData> {
  const cached = context.queryClient.getQueryData<VideoUploadStatusResponse>(videoUploadStatusQueryKey(uploadId));

  if (cached != null) {
    return { status: cached, accessible: true };
  }

  const existing = context.queryClient.getQueryState(videoUploadStatusQueryKey(uploadId));

  if (existing?.status === "error") {
    markVideoUploadStatusUnavailable(context.queryClient, uploadId);
    throw notFound();
  }

  if (typeof window === "undefined") {
    const status = await fetchVideoUploadStatusServer({
      data: { publicId: uploadId },
    });

    if (status != null) {
      context.queryClient.setQueryData(videoUploadStatusQueryKey(uploadId), status);

      return { status, accessible: true };
    }

    markVideoUploadStatusUnavailable(context.queryClient, uploadId);
    throw notFound();
  }

  if (!context.auth.isReady || context.auth.user == null) {
    markVideoUploadStatusUnavailable(context.queryClient, uploadId, 401, "Sign in required.");
    throw notFound();
  }

  try {
    const status = await context.queryClient.query({
      ...videoUploadStatusQueryOptions(uploadId),
      staleTime: 30_000,
    });

    return { status, accessible: true };
  } catch {
    markVideoUploadStatusUnavailable(context.queryClient, uploadId);
    throw notFound();
  }
}

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId")({
  ssr: true,
  loader: async ({ context, params }): Promise<UploadDetailLoaderData> => {
    return loadUploadDetailStatus(context, params.uploadId);
  },
  notFoundComponent: UploadDetailNotFound,
  component: UploadDetailLayout,
});

function UploadDetailNotFound() {
  return <UploadNotFound />;
}

function UploadDetailLayout() {
  return <Outlet />;
}
