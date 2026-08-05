import { createFileRoute } from "@tanstack/react-router";

import { CategoryBrowse } from "@/layouts/home/category-browse";
import { getTrendingVideos } from "@/libs/category-videos";

export const Route = createFileRoute("/trending")({
  component: TrendingPage,
  loader: () => ({ videos: getTrendingVideos() }),
});

function TrendingPage() {
  const { videos } = Route.useLoaderData();
  return <CategoryBrowse title="Trending" description="What everyone is watching right now." videos={videos} />;
}
