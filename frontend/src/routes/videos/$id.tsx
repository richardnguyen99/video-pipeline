import { useEffect } from "react";
import { useQueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";

import { VideoComments } from "@/components/video/comment";
import { VideoPlayer, DEMO_HLS_SRC } from "@/components/video/player";
import { VideoInfo } from "@/layouts/single-video/video-info";
import { VideoMetadata } from "@/layouts/single-video/video-metadata";
import { VideoReviewImages } from "@/layouts/single-video/video-review-images";
import { VideoSidebar } from "@/layouts/single-video/video-sidebar";
import { ApiError } from "@/libs/api-client";
import { pickVideoImageUrl, videoCommentList, videoDisplayTitle } from "@/mocks/videos";
import {
  DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT,
  videoDetailQueryOptions,
  videoRecommendationsQueryOptions,
} from "@/queries/videos";

export const Route = createFileRoute("/videos/$id")({
  component: VideoPage,
  errorComponent: VideoError,
  notFoundComponent: VideoNotFound,
  loader: async ({ context, params }) => {
    const videoId = params.id;

    try {
      await Promise.all([
        context.queryClient.ensureQueryData(videoDetailQueryOptions(videoId)),
        context.queryClient.ensureQueryData(
          videoRecommendationsQueryOptions(videoId, DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT),
        ),
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw notFound();
      }

      throw error;
    }

    return { videoId };
  },
});

function VideoPage() {
  const { videoId } = Route.useLoaderData();
  const { data: video } = useSuspenseQuery(videoDetailQueryOptions(videoId));
  const { data: related } = useSuspenseQuery(
    videoRecommendationsQueryOptions(videoId, DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT),
  );

  const comments = videoCommentList(video);
  const streamSrc =
    (typeof video.m3u8_url === "string" && video.m3u8_url) ||
    (Array.isArray(video.m3u8_urls) && video.m3u8_urls[0]) ||
    DEMO_HLS_SRC;
  const poster =
    pickVideoImageUrl(video.video_image_url) ??
    video.image_urls?.[0] ??
    pickVideoImageUrl(video.video_sample_image_url);

  return (
    <div className="mx-auto w-full px-6 py-4 sm:px-10 sm:py-6 lg:px-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <VideoPlayer src={streamSrc} poster={poster} title={videoDisplayTitle(video)} />
          <div className="mt-5 sm:mt-6">
            <VideoMetadata video={video} />
          </div>

          <VideoInfo video={video} />

          <VideoReviewImages video={video} />

          <VideoComments comments={comments} videoId={String(videoId)} />
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
