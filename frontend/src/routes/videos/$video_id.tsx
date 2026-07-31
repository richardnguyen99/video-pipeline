import React from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { VideoInfo } from "@/layouts/video_single_page/video-info";
import { VideoReviewImages } from "@/layouts/video_single_page/video-review-images";
import { VideoMetadata } from "@/layouts/video_single_page/video-metadata";
import { VideoSidebar } from "@/layouts/video_single_page/video-sidebar";
import type { Video } from "@/mocks/videos";
import { getMockRelatedVideos, getMockVideoById } from "@/mocks/videos";

export const Route = createFileRoute("/videos/$video_id")({
  component: VideoPage,
  errorComponent: VideoError,
  notFoundComponent: VideoNotFound,
  loader: async ({ params }) => {
    const { video_id } = params;
    const videoPromise = Promise.resolve(getMockVideoById(video_id));
    const related = getMockRelatedVideos(video_id, 12);

    return {
      videoPromise,
      related,
    };
  },
});

function VideoPage() {
  const { videoPromise, related } = Route.useLoaderData();

  return (
    <React.Suspense fallback={<VideoPending />}>
      <VideoContent videoPromise={videoPromise} related={related} />
    </React.Suspense>
  );
}

function VideoContent({ videoPromise, related }: { videoPromise: Promise<Video | undefined>; related: Video[] }) {
  const video = React.use(videoPromise);

  if (!video) {
    throw notFound();
  }

  return (
    <div className="mx-auto w-full px-6 py-4 sm:px-10 sm:py-6 lg:px-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <div className="relative mb-6 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-zinc-950">
            <div className="text-center text-white">
              <div className="mb-4 text-6xl">🎬</div>
              <p className="text-2xl font-medium">Video Player Placeholder</p>
              <p className="mt-2 text-sm opacity-75">Duration: {video.duration || "N/A"} minutes</p>
            </div>
          </div>

          <VideoMetadata video={video} views={124800} />
          <VideoInfo video={video} />
          <VideoReviewImages video={video} />
        </div>

        <VideoSidebar videos={related} />
      </div>
    </div>
  );
}

function VideoPending() {
  return (
    <div className="mx-auto w-full px-6 py-4 sm:px-10 sm:py-6 lg:px-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="min-w-0 flex-1 animate-pulse space-y-6">
          <div className="aspect-video rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="hidden w-90 shrink-0 animate-pulse space-y-4 lg:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="aspect-video w-[42%] rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full px-6 py-6 text-center sm:px-10 lg:px-16">
      <h2 className="mb-4 text-2xl font-semibold text-red-500">Error Loading Video</h2>
      <p className="mb-6 text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-primary px-8 py-3 text-primary-foreground hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  );
}

function VideoNotFound() {
  return (
    <div className="mx-auto w-full px-6 py-20 text-center sm:px-10 lg:px-16">
      <h2 className="mb-4 text-3xl font-semibold">Video Not Found</h2>
      <p className="text-muted-foreground">The video you&apos;re looking for doesn&apos;t exist or has been removed.</p>
    </div>
  );
}
