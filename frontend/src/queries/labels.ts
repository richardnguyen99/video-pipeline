import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { NamedEntity } from "@/mocks/videos";

export const LABEL_FILTER_OPTIONS_LIMIT = 100;

/** UI locale for label list/filter display names. */
export const DEFAULT_LABEL_LOCALE = "en-us";

export type LabelListItemApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
};

export type LabelListApiResponse = {
  items: LabelListItemApi[];
  total: number;
  limit: number;
  offset: number;
};

export type LabelDetailAkaApi = {
  id: number;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
};

export type LabelDetailApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmmId: string;
  createdAt: string;
  updatedAt: string;
  akas: LabelDetailAkaApi[];
};

export type LabelListQueryParams = {
  limit?: number;
  offset?: number;
  q?: string;
  locale?: string;
};

export const labelQueryKeys = {
  all: ["labels"] as const,
  lists: () => [...labelQueryKeys.all, "list"] as const,
  list: (params: LabelListQueryParams) => [...labelQueryKeys.lists(), params] as const,
  filterOptions: (q?: string, locale?: string) => [...labelQueryKeys.all, "filter", q ?? "", locale ?? ""] as const,
  details: () => [...labelQueryKeys.all, "detail"] as const,
  detail: (labelId: number) => [...labelQueryKeys.details(), labelId] as const,
};

export function mapLabelToNamedEntity(item: LabelListItemApi): NamedEntity {
  return {
    id: item.id,
    name: item.name,
  };
}

export async function fetchLabelList(params: LabelListQueryParams = {}): Promise<LabelListApiResponse> {
  return apiFetch<LabelListApiResponse>("/labels", {
    searchParams: {
      limit: params.limit ?? LABEL_FILTER_OPTIONS_LIMIT,
      offset: params.offset ?? 0,
      q: params.q,
      locale: params.locale,
    },
  });
}

export async function fetchLabelFilterPage(params: {
  offset?: number;
  limit?: number;
  q?: string;
  locale?: string;
}): Promise<LabelListApiResponse> {
  return fetchLabelList({
    limit: params.limit ?? LABEL_FILTER_OPTIONS_LIMIT,
    offset: params.offset ?? 0,
    q: params.q,
    locale: params.locale ?? DEFAULT_LABEL_LOCALE,
  });
}

export function labelFilterInfiniteOptions(q?: string, locale: string = DEFAULT_LABEL_LOCALE) {
  const normalized = q?.trim() ? q.trim() : undefined;
  const localeKey = locale.trim() !== "" ? locale.trim() : DEFAULT_LABEL_LOCALE;

  return infiniteQueryOptions({
    queryKey: labelQueryKeys.filterOptions(normalized, localeKey),
    queryFn: ({ pageParam }) =>
      fetchLabelFilterPage({
        offset: pageParam,
        limit: LABEL_FILTER_OPTIONS_LIMIT,
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

export function flattenLabelFilterPages(pages: LabelListApiResponse[] | undefined): NamedEntity[] {
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
      result.push(mapLabelToNamedEntity(item));
    }
  }

  return result;
}

export async function fetchLabelDetail(labelId: number) {
  return apiFetch<LabelDetailApi>(`/labels/${labelId}`);
}

export function labelDetailQueryOptions(labelId: number) {
  return queryOptions({
    queryKey: labelQueryKeys.detail(labelId),
    queryFn: () => fetchLabelDetail(labelId),
  });
}

export function mapLabelDetailToNamedEntity(item: LabelDetailApi, locale: string = DEFAULT_LABEL_LOCALE): NamedEntity {
  const localeKey = locale.trim().toLowerCase() || DEFAULT_LABEL_LOCALE;
  const aka = item.akas.find((entry) => entry.language.toLowerCase() === localeKey);

  if (aka != null && aka.name.trim() !== "") {
    return { id: item.id, name: aka.name };
  }

  return { id: item.id, name: item.name };
}
