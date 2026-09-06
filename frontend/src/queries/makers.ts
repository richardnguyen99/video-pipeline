import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { NamedEntity } from "@/mocks/videos";

export const MAKER_FILTER_OPTIONS_LIMIT = 100;

/** UI locale for maker list/filter display names. */
export const DEFAULT_MAKER_LOCALE = "en-us";

export type MakerListItemApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
};

export type MakerListApiResponse = {
  items: MakerListItemApi[];
  total: number;
  limit: number;
  offset: number;
};

export type MakerDetailAkaApi = {
  id: number;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
};

export type MakerDetailApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
  createdAt: string;
  updatedAt: string;
  akas: MakerDetailAkaApi[];
};

export type MakerListQueryParams = {
  limit?: number;
  offset?: number;
  q?: string;
  locale?: string;
};

export const makerQueryKeys = {
  all: ["makers"] as const,
  lists: () => [...makerQueryKeys.all, "list"] as const,
  list: (params: MakerListQueryParams) => [...makerQueryKeys.lists(), params] as const,
  filterOptions: (q?: string, locale?: string) => [...makerQueryKeys.all, "filter", q ?? "", locale ?? ""] as const,
  details: () => [...makerQueryKeys.all, "detail"] as const,
  detail: (makerId: number) => [...makerQueryKeys.details(), makerId] as const,
};

export function mapMakerToNamedEntity(item: MakerListItemApi): NamedEntity {
  return {
    id: item.id,
    name: item.name,
  };
}

export async function fetchMakerList(params: MakerListQueryParams = {}): Promise<MakerListApiResponse> {
  return apiFetch<MakerListApiResponse>("/makers", {
    searchParams: {
      limit: params.limit ?? MAKER_FILTER_OPTIONS_LIMIT,
      offset: params.offset ?? 0,
      q: params.q,
      locale: params.locale,
    },
  });
}

export async function fetchMakerFilterPage(params: {
  offset?: number;
  limit?: number;
  q?: string;
  locale?: string;
}): Promise<MakerListApiResponse> {
  return fetchMakerList({
    limit: params.limit ?? MAKER_FILTER_OPTIONS_LIMIT,
    offset: params.offset ?? 0,
    q: params.q,
    locale: params.locale ?? DEFAULT_MAKER_LOCALE,
  });
}

export function makerFilterInfiniteOptions(q?: string, locale: string = DEFAULT_MAKER_LOCALE) {
  const normalized = q?.trim() ? q.trim() : undefined;
  const localeKey = locale.trim() !== "" ? locale.trim() : DEFAULT_MAKER_LOCALE;

  return infiniteQueryOptions({
    queryKey: makerQueryKeys.filterOptions(normalized, localeKey),
    queryFn: ({ pageParam }) =>
      fetchMakerFilterPage({
        offset: pageParam,
        limit: MAKER_FILTER_OPTIONS_LIMIT,
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

export function flattenMakerFilterPages(pages: MakerListApiResponse[] | undefined): NamedEntity[] {
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
      result.push(mapMakerToNamedEntity(item));
    }
  }

  return result;
}

export async function fetchMakerDetail(makerId: number) {
  return apiFetch<MakerDetailApi>(`/makers/${makerId}`);
}

export function makerDetailQueryOptions(makerId: number) {
  return queryOptions({
    queryKey: makerQueryKeys.detail(makerId),
    queryFn: () => fetchMakerDetail(makerId),
  });
}

export function mapMakerDetailToNamedEntity(item: MakerDetailApi, locale: string = DEFAULT_MAKER_LOCALE): NamedEntity {
  const localeKey = locale.trim().toLowerCase() || DEFAULT_MAKER_LOCALE;
  const aka = item.akas.find((entry) => entry.language.toLowerCase() === localeKey);

  if (aka != null && aka.name.trim() !== "") {
    return { id: item.id, name: aka.name };
  }

  return { id: item.id, name: item.name };
}
