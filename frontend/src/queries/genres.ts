import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { NamedEntity } from "@/mocks/videos";

export const GENRE_FILTER_OPTIONS_LIMIT = 100;

/** UI locale for genre list/filter display names. */
export const DEFAULT_GENRE_LOCALE = "en-us";

export type GenreListItemApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
};

export type GenreListApiResponse = {
  items: GenreListItemApi[];
  total: number;
  limit: number;
  offset: number;
};

export type GenreDetailAkaApi = {
  id: number;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
};

export type GenreDetailApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
  createdAt: string;
  updatedAt: string;
  akas: GenreDetailAkaApi[];
};

export type GenreListQueryParams = {
  limit?: number;
  offset?: number;
  q?: string;
  locale?: string;
};

export const genreQueryKeys = {
  all: ["genres"] as const,
  lists: () => [...genreQueryKeys.all, "list"] as const,
  list: (params: GenreListQueryParams) => [...genreQueryKeys.lists(), params] as const,
  filterOptions: (q?: string, locale?: string) => [...genreQueryKeys.all, "filter", q ?? "", locale ?? ""] as const,
  details: () => [...genreQueryKeys.all, "detail"] as const,
  detail: (genreId: number) => [...genreQueryKeys.details(), genreId] as const,
};

export function mapGenreToNamedEntity(item: GenreListItemApi): NamedEntity {
  return {
    id: item.id,
    name: item.name,
  };
}

export async function fetchGenreList(params: GenreListQueryParams = {}): Promise<GenreListApiResponse> {
  return apiFetch<GenreListApiResponse>("/genres", {
    searchParams: {
      limit: params.limit ?? GENRE_FILTER_OPTIONS_LIMIT,
      offset: params.offset ?? 0,
      q: params.q,
      locale: params.locale,
    },
  });
}

export async function fetchGenreFilterPage(params: {
  offset?: number;
  limit?: number;
  q?: string;
  locale?: string;
}): Promise<GenreListApiResponse> {
  return fetchGenreList({
    limit: params.limit ?? GENRE_FILTER_OPTIONS_LIMIT,
    offset: params.offset ?? 0,
    q: params.q,
    locale: params.locale ?? DEFAULT_GENRE_LOCALE,
  });
}

export function genreFilterInfiniteOptions(q?: string, locale: string = DEFAULT_GENRE_LOCALE) {
  const normalized = q?.trim() ? q.trim() : undefined;
  const localeKey = locale.trim() !== "" ? locale.trim() : DEFAULT_GENRE_LOCALE;

  return infiniteQueryOptions({
    queryKey: genreQueryKeys.filterOptions(normalized, localeKey),
    queryFn: ({ pageParam }) =>
      fetchGenreFilterPage({
        offset: pageParam,
        limit: GENRE_FILTER_OPTIONS_LIMIT,
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

export function flattenGenreFilterPages(pages: GenreListApiResponse[] | undefined): NamedEntity[] {
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
      result.push(mapGenreToNamedEntity(item));
    }
  }

  return result;
}

export async function fetchGenreDetail(genreId: number) {
  return apiFetch<GenreDetailApi>(`/genres/${genreId}`);
}

export function genreDetailQueryOptions(genreId: number) {
  return queryOptions({
    queryKey: genreQueryKeys.detail(genreId),
    queryFn: () => fetchGenreDetail(genreId),
  });
}

export function mapGenreDetailToNamedEntity(item: GenreDetailApi, locale: string = DEFAULT_GENRE_LOCALE): NamedEntity {
  const localeKey = locale.trim().toLowerCase() || DEFAULT_GENRE_LOCALE;
  const aka = item.akas.find((entry) => entry.language.toLowerCase() === localeKey);

  if (aka != null && aka.name.trim() !== "") {
    return { id: item.id, name: aka.name };
  }

  return { id: item.id, name: item.name };
}
