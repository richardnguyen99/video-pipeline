import { createFileRoute, notFound } from "@tanstack/react-router";

import { ActressDetail } from "@/layouts/single-actress/actress-detail";
import { ActressVideosGridSkeleton } from "@/layouts/single-actress/actress-videos-skeleton";
import type { ActressVideoFilters, ActressVideoSearchParams, ActressVideoSort } from "@/libs/actress-videos";
import { DEFAULT_ACTRESS_VIDEO_SORT, actressVideoListQueryParams } from "@/libs/actress-videos";
import { ApiError } from "@/libs/api-client";
import { actressSummaryQueryOptions } from "@/queries/actresses";
import { genreFilterInfiniteOptions } from "@/queries/genres";
import { videoListQueryOptions } from "@/queries/videos";

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

    const rawPage = search.page;
    const pageNum = typeof rawPage === "number" ? rawPage : Number(rawPage);
    if (Number.isFinite(pageNum) && pageNum > 1) {
      result.page = Math.floor(pageNum);
    }

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
  loader: async ({ context, params, deps }) => {
    const id = Number.parseInt(params.actressId, 10);

    if (Number.isNaN(id)) {
      throw notFound();
    }

    let actress;

    try {
      actress = await context.queryClient.ensureQueryData(actressSummaryQueryOptions(id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw notFound();
      }

      throw error;
    }

    const filters: ActressVideoFilters = {
      labels: deps.labels ?? [],
      genres: deps.genres ?? [],
      makers: deps.makers ?? [],
    };
    const sort = deps.sort ?? DEFAULT_ACTRESS_VIDEO_SORT;
    const page = deps.page ?? 1;

    const pagePromise = context.queryClient.ensureQueryData(
      videoListQueryOptions(actressVideoListQueryParams(id, { page, sort, filters })),
    );

    await context.queryClient.ensureInfiniteQueryData(genreFilterInfiniteOptions());

    return {
      actress,
      sort,
      filters,
      pagePromise,
    };
  },
  pendingComponent: () => (
    <div className="min-h-screen pt-16">
      <div className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-16">
        <ActressVideosGridSkeleton />
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center pt-16">
      <p className="text-muted-foreground">Actress not found.</p>
    </div>
  ),
});

function ActressDetailPage() {
  const data = Route.useLoaderData();

  return (
    <ActressDetail actress={data.actress} sort={data.sort} filters={data.filters} pagePromise={data.pagePromise} />
  );
}
