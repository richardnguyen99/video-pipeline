import { createFileRoute } from "@tanstack/react-router";

import { ActressesIndex } from "@/layouts/actresses/actresses-index";
import type { ActressFilters, ActressSort, ActressesSearchParams } from "@/libs/actresses";
import { DEFAULT_ACTRESS_SORT, getActressPage } from "@/libs/actresses";

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
  loader: ({ deps }) => {
    const filters: ActressFilters = {
      labels: deps.labels ?? [],
      genres: deps.genres ?? [],
      makers: deps.makers ?? [],
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

    return getActressPage(deps.page ?? 1, {
      sort: deps.sort ?? DEFAULT_ACTRESS_SORT,
      filters: filters,
    });
  },
});

function ActressesPage() {
  const data = Route.useLoaderData();

  return (
    <ActressesIndex
      actresses={data.items}
      page={data.page}
      totalPages={data.totalPages}
      total={data.total}
      sort={data.sort}
      filters={data.filters}
    />
  );
}
