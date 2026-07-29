import React from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import type { Video } from "@/mocks/videos";
import { getMockVideoById } from "@/mocks/videos";
import { VideoMetadata } from "@/components/video/video-metadata";

export const Route = createFileRoute("/videos/$video_id")({
  component: VideoPage,
  errorComponent: VideoError,
  notFoundComponent: VideoNotFound,
  loader: async ({ params }) => {
    const { video_id } = params;
    const videoPromise = getMockVideoById(video_id);

    return {
      videoPromise,
    };
  },
});

function VideoPage() {
  const { videoPromise } = Route.useLoaderData();

  return (
    <React.Suspense fallback={<VideoPending />}>
      <VideoContent videoPromise={videoPromise} />
    </React.Suspense>
  );
}

function VideoContent({ videoPromise }: { videoPromise: Promise<Video | undefined> }) {
  const video = React.use(videoPromise);

  if (!video) {
    throw notFound();
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Player */}
      <div className="aspect-video bg-zinc-950 rounded-2xl flex items-center justify-center mb-6 relative overflow-hidden">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-2xl font-medium">Video Player Placeholder</p>
          <p className="text-sm mt-2 opacity-75">Duration: {video.duration || "N/A"} minutes</p>
        </div>
      </div>

      {/* Metadata section (title + toolbar + report dialog) */}
      <VideoMetadata video={video} views={124800} />

      {/* Extra details below toolbar */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <h3 className="font-semibold text-lg mb-4">Details</h3>
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium">Release Date:</span> {video.release_date || "Unknown"}
            </p>
            <p>
              <span className="font-medium">Duration:</span> {video.duration} minutes
            </p>
            {video.cid && (
              <p>
                <span className="font-medium">CID:</span> {video.cid}
              </p>
            )}
            {video.maker_product && (
              <p>
                <span className="font-medium">Maker:</span> {video.maker_product}
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-4">Cast</h3>
          <div className="flex flex-wrap gap-2">
            {video.actresses?.map((actress) => (
              <span key={actress.id} className="bg-secondary px-4 py-1.5 rounded-full text-sm">
                {actress.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoPending() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="animate-pulse space-y-6">
        <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
      </div>
    </div>
  );
}

function VideoError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-6xl mx-auto p-6 text-center">
      <h2 className="text-2xl font-semibold text-red-500 mb-4">Error Loading Video</h2>
      <p className="mb-6 text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">
        Try Again
      </button>
    </div>
  );
}

function VideoNotFound() {
  return (
    <div className="max-w-6xl mx-auto p-6 text-center py-20">
      <h2 className="text-3xl font-semibold mb-4">Video Not Found</h2>
      <p className="text-muted-foreground">The video you're looking for doesn't exist or has been removed.</p>
    </div>
  );
}
