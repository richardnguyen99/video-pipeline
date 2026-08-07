import { createFileRoute, notFound } from "@tanstack/react-router";

import { ActressDetail } from "@/layouts/actresses/actress-detail";
import { getActressById, getVideosByActressId } from "@/libs/actresses";

export const Route = createFileRoute("/actresses/$actressId")({
  component: ActressDetailPage,
  loader: ({ params }) => {
    const id = Number.parseInt(params.actressId, 10);
    if (Number.isNaN(id)) throw notFound();

    const actress = getActressById(id);
    if (!actress) throw notFound();

    return {
      actress,
      videos: getVideosByActressId(id),
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center pt-16">
      <p className="text-muted-foreground">Actress not found.</p>
    </div>
  ),
});

function ActressDetailPage() {
  const { actress, videos } = Route.useLoaderData();

  return <ActressDetail actress={actress} videos={videos} />;
}
