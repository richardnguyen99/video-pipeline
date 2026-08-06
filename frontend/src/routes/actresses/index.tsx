import { createFileRoute } from "@tanstack/react-router";

import { ActressesIndex } from "@/layouts/actresses/actresses-index";
import { getActressPage } from "@/libs/actresses";

type ActressesSearch = {
  page?: number;
};

export const Route = createFileRoute("/actresses/")({
  component: ActressesPage,
  validateSearch: (search: Record<string, unknown>): ActressesSearch => {
    const raw = search.page;
    const page = typeof raw === "number" ? raw : Number(raw);
    return {
      page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    };
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ deps }) => getActressPage(deps.page),
});

function ActressesPage() {
  const { items, page, totalPages, total } = Route.useLoaderData();
  return <ActressesIndex actresses={items} page={page} totalPages={totalPages} total={total} />;
}
