import { createFileRoute } from "@tanstack/react-router";

import { VideoBrowse } from "@/layouts/video-browse";
import { getForYouVideos } from "@/libs/category-videos";

export const Route = createFileRoute("/for-you")({
  component: ForYouPage,
  loader: () => ({ videos: getForYouVideos() }),
});

function ForYouPage() {
  const { videos } = Route.useLoaderData();
  return <VideoBrowse title="For you" description="Picks tailored to your taste." videos={videos} />;
}
