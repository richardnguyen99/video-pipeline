import { createFileRoute } from "@tanstack/react-router";

import { CategoryBrowse } from "@/layouts/home/category-browse";
import { getLatestVideos } from "@/libs/category-videos";

export const Route = createFileRoute("/latest")({
  component: LatestPage,
  loader: () => ({ videos: getLatestVideos() }),
});

function LatestPage() {
  const { videos } = Route.useLoaderData();
  return <CategoryBrowse title="Latest" description="Fresh releases just added." videos={videos} />;
}
