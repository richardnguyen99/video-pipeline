import React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ActressesGrid, ActressesShell } from "@/layouts/actresses/actresses-index";
import { ActressesGridSkeleton, ActressesIndexSkeleton } from "@/layouts/actresses/actresses-index-skeleton";
import type { ActressFilters, ActressPageResult, ActressSort, ActressesSearchParams } from "@/libs/actresses";
import { DEFAULT_ACTRESS_SORT } from "@/libs/actresses";
import { actressListQueryOptions } from "@/queries/actresses";
import { genreFilterInfiniteOptions } from "@/queries/genres";
import { seriesFilterInfiniteOptions } from "@/queries/series";
import { Skeleton } from "@/components/ui/skeleton";

const SORT_VALUES: ActressSort[] = [
  "trending-year",
  "trending-month",
  "trending-week",
  "most-viewed",
  "most-videos",
  "most-subscribed",
  "most-likes",
];

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

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const list = value.filter((v): v is string => typeof v === "string");

    return list.length > 0 ? list : undefined;
  }

  if (typeof value === "string" && value.length > 0) {
    const list = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);

    return Number.isFinite(n) ? n : undefined;
  }

  return undefined;
}

function asSort(value: unknown): ActressSort | undefined {
  if (typeof value === "string" && SORT_VALUES.includes(value as ActressSort)) {
    return value as ActressSort;
  }

  return undefined;
}

export const Route = createFileRoute("/actresses/")({
  component: ActressesPage,
  validateSearch: (search: Record<string, unknown>): ActressesSearchParams => {
    const result: ActressesSearchParams = {};
    const rawPage = search.page;
    const pageNum = typeof rawPage === "number" ? rawPage : Number(rawPage);

    if (Number.isFinite(pageNum) && pageNum > 1) {
      result.page = Math.floor(pageNum);
    }

    const sort = asSort(search.sort);
    if (sort && sort !== DEFAULT_ACTRESS_SORT) {
      result.sort = sort;
    }

    const labels = asIdArray(search.labels);
    if (labels) result.labels = labels;

    const genres = asIdArray(search.genres);
    if (genres) result.genres = genres;

    const series = asIdArray(search.series);
    if (series) result.series = series;

    const makers = asIdArray(search.makers);
    if (makers) result.makers = makers;

    const cups = asStringArray(search.cups);
    if (cups) result.cups = cups;

    const numericKeys = [
      "bustMin",
      "bustMax",
      "waistMin",
      "waistMax",
      "hipMin",
      "hipMax",
      "heightMin",
      "heightMax",
      "ageMin",
      "ageMax",
    ] as const;

    for (const key of numericKeys) {
      const n = asOptionalNumber(search[key]);

      if (typeof n === "number") result[key] = n;
    }

    return result;
  },

  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const filters: ActressFilters = {
      labels: deps.labels ?? [],
      genres: deps.genres ?? [],
      makers: deps.makers ?? [],
      series: deps.series ?? [],
      cups: deps.cups ?? [],
      bustMin: deps.bustMin,
      bustMax: deps.bustMax,
      waistMin: deps.waistMin,
      waistMax: deps.waistMax,
      hipMin: deps.hipMin,
      hipMax: deps.hipMax,
      heightMin: deps.heightMin,
      heightMax: deps.heightMax,
      ageMin: deps.ageMin,
      ageMax: deps.ageMax,
    };

    const sort = deps.sort ?? DEFAULT_ACTRESS_SORT;
    const page = deps.page ?? 1;

    const pagePromise = context.queryClient.ensureQueryData(actressListQueryOptions({ page, sort, filters }));

    await Promise.all([
      context.queryClient.ensureInfiniteQueryData(genreFilterInfiniteOptions()),
      context.queryClient.ensureInfiniteQueryData(seriesFilterInfiniteOptions()),
    ]);

    return {
      sort,
      filters,
      page,
      pagePromise,
    };
  },
  pendingComponent: ActressesIndexSkeleton,
});

function ActressesPage() {
  const { sort, filters, pagePromise } = Route.useLoaderData();

  return (
    <ActressesShell
      sort={sort}
      filters={filters}
      totalSlot={
        <React.Suspense fallback={<Skeleton className="ml-1 inline-block h-4 w-24 align-middle sm:h-5" />}>
          <ActressesTotalCount pagePromise={pagePromise} />
        </React.Suspense>
      }
    >
      <React.Suspense fallback={<ActressesGridSkeleton />}>
        <ActressesGridContent pagePromise={pagePromise} />
      </React.Suspense>
    </ActressesShell>
  );
}

function ActressesTotalCount({ pagePromise }: { pagePromise: Promise<ActressPageResult> }) {
  const data = React.use(pagePromise);
  return <>{` ${data.total} profiles.`}</>;
}

function ActressesGridContent({ pagePromise }: { pagePromise: Promise<ActressPageResult> }) {
  const data = React.use(pagePromise);

  return (
    <ActressesGrid
      actresses={data.items}
      page={data.page}
      totalPages={data.totalPages}
      sort={data.sort}
      filters={data.filters}
    />
  );
}
