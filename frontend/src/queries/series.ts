import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { NamedEntity } from "@/mocks/videos";

export const SERIES_FILTER_OPTIONS_LIMIT = 100;

/** UI locale for series list/filter display names. */
export const DEFAULT_SERIES_LOCALE = "en-us";

export type SeriesListItemApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
};

export type SeriesListApiResponse = {
  items: SeriesListItemApi[];
  total: number;
  limit: number;
  offset: number;
};

export type SeriesDetailAkaApi = {
  id: number;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
};

export type SeriesDetailApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
  createdAt: string;
  updatedAt: string;
  akas: SeriesDetailAkaApi[];
};

export type SeriesListQueryParams = {
  limit?: number;
  offset?: number;
  q?: string;
  locale?: string;
};

export const seriesQueryKeys = {
  all: ["series"] as const,
  lists: () => [...seriesQueryKeys.all, "list"] as const,
  list: (params: SeriesListQueryParams) => [...seriesQueryKeys.lists(), params] as const,
  filterOptions: (q?: string, locale?: string) => [...seriesQueryKeys.all, "filter", q ?? "", locale ?? ""] as const,
  details: () => [...seriesQueryKeys.all, "detail"] as const,
  detail: (seriesId: number) => [...seriesQueryKeys.details(), seriesId] as const,
};

export function mapSeriesToNamedEntity(item: SeriesListItemApi): NamedEntity {
  return {
    id: item.id,
    name: item.name,
  };
}

export async function fetchSeriesList(params: SeriesListQueryParams = {}): Promise<SeriesListApiResponse> {
  return apiFetch<SeriesListApiResponse>("/series", {
    searchParams: {
      limit: params.limit ?? SERIES_FILTER_OPTIONS_LIMIT,
      offset: params.offset ?? 0,
      q: params.q,
      locale: params.locale,
    },
  });
}

export async function fetchSeriesFilterPage(params: {
  offset?: number;
  limit?: number;
  q?: string;
  locale?: string;
}): Promise<SeriesListApiResponse> {
  return fetchSeriesList({
    limit: params.limit ?? SERIES_FILTER_OPTIONS_LIMIT,
    offset: params.offset ?? 0,
    q: params.q,
    locale: params.locale ?? DEFAULT_SERIES_LOCALE,
  });
}

export function seriesFilterInfiniteOptions(q?: string, locale: string = DEFAULT_SERIES_LOCALE) {
  const normalized = q?.trim() ? q.trim() : undefined;
  const localeKey = locale.trim() !== "" ? locale.trim() : DEFAULT_SERIES_LOCALE;

  return infiniteQueryOptions({
    queryKey: seriesQueryKeys.filterOptions(normalized, localeKey),
    queryFn: ({ pageParam }) =>
      fetchSeriesFilterPage({
        offset: pageParam,
        limit: SERIES_FILTER_OPTIONS_LIMIT,
        q: normalized,
        locale: localeKey,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;

      if (nextOffset >= lastPage.total) {
        return undefined;
      }

      return nextOffset;
    },
  });
}

export function flattenSeriesFilterPages(pages: SeriesListApiResponse[] | undefined): NamedEntity[] {
  if (pages == null) {
    return [];
  }

  const seen = new Set<number>();
  const result: NamedEntity[] = [];

  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) {
        continue;
      }

      seen.add(item.id);
      result.push(mapSeriesToNamedEntity(item));
    }
  }

  return result;
}

export async function fetchSeriesDetail(seriesId: number) {
  return apiFetch<SeriesDetailApi>(`/series/${seriesId}`);
}

export function seriesDetailQueryOptions(seriesId: number) {
  return queryOptions({
    queryKey: seriesQueryKeys.detail(seriesId),
    queryFn: () => fetchSeriesDetail(seriesId),
  });
}

export function mapSeriesDetailToNamedEntity(
  item: SeriesDetailApi,
  locale: string = DEFAULT_SERIES_LOCALE,
): NamedEntity {
  const localeKey = locale.trim().toLowerCase() || DEFAULT_SERIES_LOCALE;
  const aka = item.akas.find((entry) => entry.language.toLowerCase() === localeKey);

  if (aka != null && aka.name.trim() !== "") {
    return { id: item.id, name: aka.name };
  }

  return { id: item.id, name: item.name };
}
