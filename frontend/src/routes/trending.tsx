import { createFileRoute } from "@tanstack/react-router";

import { VideoBrowse } from "@/layouts/video-browse";
import { getTrendingVideos } from "@/libs/category-videos";

export const Route = createFileRoute("/trending")({
  component: TrendingPage,
  loader: () => ({ videos: getTrendingVideos() }),
});

function TrendingPage() {
  const { videos } = Route.useLoaderData();
  return <VideoBrowse title="Trending" description="What everyone is watching right now." videos={videos} />;
}
