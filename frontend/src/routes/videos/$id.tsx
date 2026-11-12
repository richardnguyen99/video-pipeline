import { Suspense, useEffect } from "react";
import { useQuery, useQueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";

import { VideoComments } from "@/layouts/single-video/comment";
import { VideoPlayer, DEMO_HLS_SRC } from "@/layouts/single-video/player";
import { VideoInfo } from "@/layouts/single-video/video-info";
import { VideoMetadata } from "@/layouts/single-video/video-metadata";
import { VideoReviewImages } from "@/layouts/single-video/video-review-images";
import { VideoSidebar } from "@/layouts/single-video/video-sidebar";
import { VideoSidebarSkeleton } from "@/layouts/single-video/video-sidebar-skeleton";
import { ApiError } from "@/libs/api-client";
import { pickVideoImageUrl, videoDisplayTitle } from "@/types/video";
import type { VideoComment } from "@/queries/comments";
import {
  DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT,
  videoDetailQueryOptions,
  videoQueryKeys,
  videoRecommendationsQueryOptions,
} from "@/queries/videos";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/videos/$id")({
  component: VideoPage,
  errorComponent: VideoError,
  notFoundComponent: VideoNotFound,
  loader: async ({ context, params }) => {
    const videoId = params.id;

    try {
      await context.queryClient.query({
        ...videoDetailQueryOptions(videoId),
        staleTime: 30_000,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        context.queryClient.removeQueries({
          queryKey: videoQueryKeys.detail(videoId),
        });
      } else {
        throw error;
      }
    }

    void context.queryClient
      .query(videoRecommendationsQueryOptions(videoId, DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT))
      .catch(() => undefined);

    return { videoId };
  },
});

function VideoPage() {
  const { videoId } = Route.useLoaderData();
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const detailQuery = useQuery({
    ...videoDetailQueryOptions(videoId),
    enabled: !isRestoring,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }

      return failureCount < 2;
    },
  });

  if (isRestoring || detailQuery.isPending) {
    return <VideoDetailSkeleton />;
  }

  if (detailQuery.isError) {
    if (detailQuery.error instanceof ApiError && detailQuery.error.status === 404) {
      throw notFound();
    }

    throw detailQuery.error;
  }

  const video = detailQuery.data;

  const comments: Array<VideoComment> = video.comment_tree ?? [];
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
          <VideoPlayer
            src={streamSrc}
            poster={poster}
            title={videoDisplayTitle(video)}
            videoId={typeof video.id === "number" ? video.id : Number(videoId)}
          />

          <div className="mt-5 sm:mt-6">
            <VideoMetadata video={video} />
          </div>

          <VideoInfo video={video} />

          <VideoReviewImages video={video} />

          <VideoComments comments={comments} videoId={String(videoId)} />
        </div>

        <Suspense fallback={<VideoSidebarSkeleton />}>
          <VideoSidebarDeferred videoId={videoId} />
        </Suspense>
      </div>
    </div>
  );
}

function VideoSidebarDeferred({ videoId }: { videoId: string }) {
  const { data: related } = useSuspenseQuery(
    videoRecommendationsQueryOptions(videoId, DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT),
  );

  return <VideoSidebar videoId={videoId} videos={related} />;
}

function VideoDetailSkeleton() {
  return (
    <div className="mx-auto w-full px-6 py-4 sm:px-10 sm:py-6 lg:px-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="bg-muted aspect-video w-full animate-pulse rounded-lg" />

          <div className="bg-muted h-7 w-2/3 animate-pulse rounded" />

          <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />

          <div className="bg-muted h-24 w-full animate-pulse rounded" />
        </div>

        <VideoSidebarSkeleton />
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

      <p className="text-muted-foreground mt-2">{error.message}</p>

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

      <p className="text-muted-foreground mt-2">The requested video does not exist.</p>
    </div>
  );
}
