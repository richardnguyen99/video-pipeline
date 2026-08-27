import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { NamedEntity } from "@/mocks/videos";

export type ActressAkaApi = {
  id: number;
  translated_name: string;
};

export type ActressListItemApi = {
  id: number;
  name: string;
  ruby?: string | null;
  aka?: ActressAkaApi | null;
};

export type ActressListApiResponse = {
  items: ActressListItemApi[];
  total: number;
  limit: number;
  offset: number;
};

export type ActressListQueryParams = {
  limit?: number;
  offset?: number;
  page?: number;
  q?: string;
  sort?: number;
  cups?: string[];
  genres?: number[];
  makers?: number[];
};

/** Backend sort: 7 = total videos descending. */
export const ACTRESS_SORT_BY_VIDEO_CNT = 7;

export const ACTRESS_FILTER_OPTIONS_LIMIT = 100;

export const actressQueryKeys = {
  all: ["actresses"] as const,
  lists: () => [...actressQueryKeys.all, "list"] as const,
  list: (params: ActressListQueryParams) => [...actressQueryKeys.lists(), params] as const,
  filterOptions: (q?: string) => [...actressQueryKeys.all, "filter-options", q ?? ""] as const,
  details: () => [...actressQueryKeys.all, "detail"] as const,
  detail: (actressId: number) => [...actressQueryKeys.details(), actressId] as const,
};

export function mapActressToNamedEntity(item: ActressListItemApi): NamedEntity {
  const translated = item.aka?.translated_name.trim() ?? "";

  return {
    id: item.id,
    name: translated ? translated : item.name,
  };
}

export async function fetchActressList(params: ActressListQueryParams) {
  const limit = params.limit ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const offset = params.offset ?? (page - 1) * limit;

  return apiFetch<ActressListApiResponse>("/actresses", {
    searchParams: {
      limit,
      offset,
      q: params.q,
      sort: params.sort,
      cups: params.cups,
      genres: params.genres,
      makers: params.makers,
    },
  });
}

export async function fetchActressFilterPage(params: {
  offset?: number;
  limit?: number;
  q?: string;
}): Promise<ActressListApiResponse> {
  return fetchActressList({
    limit: params.limit ?? ACTRESS_FILTER_OPTIONS_LIMIT,
    offset: params.offset ?? 0,
    sort: ACTRESS_SORT_BY_VIDEO_CNT,
    q: params.q,
  });
}

export async function fetchActressFilterOptions(): Promise<NamedEntity[]> {
  const response = await fetchActressFilterPage({ offset: 0 });
  const options = response.items.map(mapActressToNamedEntity);

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchActressById(actressId: number) {
  return apiFetch<ActressListItemApi>(`/actresses/${actressId}`);
}

export function actressListQueryOptions(params: ActressListQueryParams) {
  return queryOptions({
    queryKey: actressQueryKeys.list(params),
    queryFn: () => fetchActressList(params),
  });
}

export function actressFilterOptionsQueryOptions() {
  return queryOptions({
    queryKey: actressQueryKeys.filterOptions(),
    queryFn: () => fetchActressFilterOptions(),
    staleTime: 5 * 60_000,
  });
}

export function actressFilterInfiniteOptions(q?: string) {
  const trimmed = q?.trim() || undefined;

  return infiniteQueryOptions({
    queryKey: actressQueryKeys.filterOptions(trimmed),
    queryFn: ({ pageParam }) =>
      fetchActressFilterPage({
        offset: pageParam,
        q: trimmed,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);

      if (loaded >= lastPage.total) {
        return undefined;
      }

      return loaded;
    },
    staleTime: 5 * 60_000,
  });
}

export function actressDetailQueryOptions(actressId: number) {
  return queryOptions({
    queryKey: actressQueryKeys.detail(actressId),
    queryFn: () => fetchActressById(actressId),
  });
}

export function flattenActressFilterPages(pages: ActressListApiResponse[] | undefined): NamedEntity[] {
  if (!pages) {
    return [];
  }

  const map = new Map<number, NamedEntity>();

  for (const page of pages) {
    for (const item of page.items) {
      const entity = mapActressToNamedEntity(item);
      map.set(entity.id, entity);
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
