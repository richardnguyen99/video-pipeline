import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { NamedEntity } from "@/mocks/videos";

export const DIRECTOR_FILTER_OPTIONS_LIMIT = 100;

/** UI locale for director list/filter display names. */
export const DEFAULT_DIRECTOR_LOCALE = "en-us";

export type DirectorListItemApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
};

export type DirectorListApiResponse = {
  items: DirectorListItemApi[];
  total: number;
  limit: number;
  offset: number;
};

export type DirectorDetailAkaApi = {
  id: number;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
};

export type DirectorDetailApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
  createdAt: string;
  updatedAt: string;
  akas: DirectorDetailAkaApi[];
};

export type DirectorListQueryParams = {
  limit?: number;
  offset?: number;
  q?: string;
  locale?: string;
};

export const directorQueryKeys = {
  all: ["directors"] as const,
  lists: () => [...directorQueryKeys.all, "list"] as const,
  list: (params: DirectorListQueryParams) => [...directorQueryKeys.lists(), params] as const,
  filterOptions: (q?: string, locale?: string) => [...directorQueryKeys.all, "filter", q ?? "", locale ?? ""] as const,
  details: () => [...directorQueryKeys.all, "detail"] as const,
  detail: (directorId: number) => [...directorQueryKeys.details(), directorId] as const,
};

export function mapDirectorToNamedEntity(item: DirectorListItemApi): NamedEntity {
  return {
    id: item.id,
    name: item.name,
  };
}

export async function fetchDirectorList(params: DirectorListQueryParams = {}): Promise<DirectorListApiResponse> {
  return apiFetch<DirectorListApiResponse>("/directors", {
    searchParams: {
      limit: params.limit ?? DIRECTOR_FILTER_OPTIONS_LIMIT,
      offset: params.offset ?? 0,
      q: params.q,
      locale: params.locale,
    },
  });
}

export async function fetchDirectorFilterPage(params: {
  offset?: number;
  limit?: number;
  q?: string;
  locale?: string;
}): Promise<DirectorListApiResponse> {
  return fetchDirectorList({
    limit: params.limit ?? DIRECTOR_FILTER_OPTIONS_LIMIT,
    offset: params.offset ?? 0,
    q: params.q,
    locale: params.locale ?? DEFAULT_DIRECTOR_LOCALE,
  });
}

export function directorFilterInfiniteOptions(q?: string, locale: string = DEFAULT_DIRECTOR_LOCALE) {
  const normalized = q?.trim() ? q.trim() : undefined;
  const localeKey = locale.trim() !== "" ? locale.trim() : DEFAULT_DIRECTOR_LOCALE;

  return infiniteQueryOptions({
    queryKey: directorQueryKeys.filterOptions(normalized, localeKey),
    queryFn: ({ pageParam }) =>
      fetchDirectorFilterPage({
        offset: pageParam,
        limit: DIRECTOR_FILTER_OPTIONS_LIMIT,
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

export function flattenDirectorFilterPages(pages: DirectorListApiResponse[] | undefined): NamedEntity[] {
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
      result.push(mapDirectorToNamedEntity(item));
    }
  }

  return result;
}

export async function fetchDirectorDetail(directorId: number) {
  return apiFetch<DirectorDetailApi>(`/directors/${directorId}`);
}

export function directorDetailQueryOptions(directorId: number) {
  return queryOptions({
    queryKey: directorQueryKeys.detail(directorId),
    queryFn: () => fetchDirectorDetail(directorId),
  });
}

export function mapDirectorDetailToNamedEntity(
  item: DirectorDetailApi,
  locale: string = DEFAULT_DIRECTOR_LOCALE,
): NamedEntity {
  const localeKey = locale.trim().toLowerCase() || DEFAULT_DIRECTOR_LOCALE;
  const aka = item.akas.find((entry) => entry.language.toLowerCase() === localeKey);

  if (aka != null && aka.name.trim() !== "") {
    return { id: item.id, name: aka.name };
  }

  return { id: item.id, name: item.name };
}
