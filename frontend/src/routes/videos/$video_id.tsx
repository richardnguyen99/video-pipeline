import { useEffect } from "react";
import { useQueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";

import { VideoComments } from "@/components/video/comment";
import { VideoPlayer, DEMO_HLS_SRC } from "@/components/video/player";
import { VideoInfo } from "@/layouts/video_single_page/video-info";
import { VideoMetadata } from "@/layouts/video_single_page/video-metadata";
import { VideoReviewImages } from "@/layouts/video_single_page/video-review-images";
import { VideoSidebar } from "@/layouts/video_single_page/video-sidebar";
import { ApiError } from "@/libs/api-client";
import { getMockComments } from "@/mocks/comments";
import { getMockRelatedVideos } from "@/mocks/videos";
import { videoDetailQueryOptions } from "@/queries/videos";

export const Route = createFileRoute("/videos/$video_id")({
  component: VideoPage,
  errorComponent: VideoError,
  notFoundComponent: VideoNotFound,
  loader: async ({ context, params }) => {
    const videoId = params.video_id;

    try {
      await context.queryClient.ensureQueryData(videoDetailQueryOptions(videoId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw notFound();
      }

      throw error;
    }

    return {
      videoId,
      related: getMockRelatedVideos(String(videoId), 12),
    };
  },
});

function VideoPage() {
  const { videoId, related } = Route.useLoaderData();
  const { data: video } = useSuspenseQuery(videoDetailQueryOptions(videoId));

  const comments = getMockComments(String(videoId));
  const streamSrc =
    "m3u8_url" in video && typeof video.m3u8_url === "string" && video.m3u8_url ? video.m3u8_url : DEMO_HLS_SRC;

  return (
    <div className="mx-auto w-full px-6 py-4 sm:px-10 sm:py-6 lg:px-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <VideoPlayer src={streamSrc} />
          <VideoMetadata video={video} />
          <VideoInfo video={video} />
          <VideoReviewImages video={video} />
          <VideoComments comments={comments} videoId={videoId} />
        </div>
        <VideoSidebar videos={related} />
      </div>
    </div>
  );
}

function VideoError({ error }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return (
    <div className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-16">
      <h1 className="text-xl font-semibold">Failed to load video</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <button
        type="button"
        className="mt-4 rounded-md border px-3 py-1.5 text-sm"
        onClick={() => {
          router.invalidate();
        }}
      >
        Retry
      </button>
    </div>
  );
}

function VideoNotFound() {
  return (
    <div className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-16">
      <h1 className="text-xl font-semibold">Video not found</h1>
      <p className="mt-2 text-muted-foreground">The requested video does not exist.</p>
    </div>
  );
}
