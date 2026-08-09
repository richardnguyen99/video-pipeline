import { createFileRoute, notFound } from "@tanstack/react-router";

import { ActressDetail } from "@/layouts/single-actress/actress-detail";
import type { ActressVideoFilters, ActressVideoSearchParams, ActressVideoSort } from "@/libs/actress-videos";
import { DEFAULT_ACTRESS_VIDEO_SORT, getActressVideoPage } from "@/libs/actress-videos";
import { getActressById } from "@/libs/actresses";

const SORT_VALUES: ActressVideoSort[] = ["latest", "most-viewed", "most-liked", "most-comments", "title"];

function asIdArray(value: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    const list = value
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((n): n is number => Number.isFinite(n));
    return list.length > 0 ? list : undefined;
  }
  if (typeof value === "string" && value.length > 0) {
    const list = value
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    return list.length > 0 ? list : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return [value];
  }
  return undefined;
}

function asSort(value: unknown): ActressVideoSort | undefined {
  if (typeof value === "string" && SORT_VALUES.includes(value as ActressVideoSort)) {
    return value as ActressVideoSort;
  }
  return undefined;
}

export const Route = createFileRoute("/actresses/$actressId")({
  component: ActressDetailPage,
  validateSearch: (search: Record<string, unknown>): ActressVideoSearchParams => {
    const result: ActressVideoSearchParams = {};

    const sort = asSort(search.sort);
    if (sort && sort !== DEFAULT_ACTRESS_VIDEO_SORT) {
      result.sort = sort;
    }

    const labels = asIdArray(search.labels);
    if (labels) result.labels = labels;
    const genres = asIdArray(search.genres);
    if (genres) result.genres = genres;
    const makers = asIdArray(search.makers);
    if (makers) result.makers = makers;

    return result;
  },
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    const id = Number.parseInt(params.actressId, 10);
    if (Number.isNaN(id)) throw notFound();

    const actress = getActressById(id);
    if (!actress) throw notFound();

    const filters: ActressVideoFilters = {
      labels: deps.labels ?? [],
      genres: deps.genres ?? [],
      makers: deps.makers ?? [],
    };

    const page = getActressVideoPage(id, {
      sort: deps.sort ?? DEFAULT_ACTRESS_VIDEO_SORT,
      filters,
    });

    return {
      actress,
      videos: page.videos,
      total: page.total,
      sort: page.sort,
      filters: page.filters,
      allVideos: page.allVideos,
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center pt-16">
      <p className="text-muted-foreground">Actress not found.</p>
    </div>
  ),
});

function ActressDetailPage() {
  const data = Route.useLoaderData();

  return (
    <ActressDetail
      actress={data.actress}
      videos={data.videos}
      total={data.total}
      sort={data.sort}
      filters={data.filters}
      allVideos={data.allVideos}
    />
  );
}
