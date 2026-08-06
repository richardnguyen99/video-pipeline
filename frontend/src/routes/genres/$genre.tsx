import { createFileRoute, notFound } from "@tanstack/react-router";

import { VideoBrowse } from "@/layouts/video-browse";
import { getGenreNameBySlug, getVideosByGenreSlug } from "@/libs/category-videos";

export const Route = createFileRoute("/genres/$genre")({
  component: GenrePage,
  loader: ({ params }) => {
    const name = getGenreNameBySlug(params.genre);
    if (!name) {
      throw notFound();
    }
    return {
      name,
      videos: getVideosByGenreSlug(params.genre),
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center pt-16">
      <p className="text-muted-foreground">Genre not found.</p>
    </div>
  ),
});

function GenrePage() {
  const { name, videos } = Route.useLoaderData();
  return <VideoBrowse title={name} description={`Browse ${name.toLowerCase()} titles.`} videos={videos} />;
}
