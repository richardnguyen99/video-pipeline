import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { ActressFilters, ActressPageResult, ActressSort, ActressSummary } from "@/libs/actresses";
import { ACTRESSES_PAGE_SIZE, DEFAULT_ACTRESS_FILTERS, DEFAULT_ACTRESS_SORT } from "@/libs/actresses";
import type { NamedEntity } from "@/mocks/videos";

export type ActressAkaApi = {
  id: number;
  translated_name: string;
};

export type ActressImageApi = {
  id: number;
  url: string;
  attribute: string;
};

export type ActressListItemApi = {
  id: number;
  name: string;
  ruby?: string | null;
  dmm_id?: string | null;
  bust?: number | null;
  cup?: string | null;
  waist?: number | null;
  hip?: number | null;
  height?: number | null;
  birthday?: string | null;
  video_cnt?: number;
  sub_cnt?: number;
  view_cnt?: number;
  like_cnt?: number;
  comment_cnt?: number;
  aka?: ActressAkaApi | null;
  image?: ActressImageApi[] | null;
  banner?: { id: number; url: string } | null;
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
  labels?: number[];
  bustMin?: number;
  bustMax?: number;
  waistMin?: number;
  waistMax?: number;
  hipMin?: number;
  hipMax?: number;
  heightMin?: number;
  heightMax?: number;
  ageMin?: number;
  ageMax?: number;
};

/** Backend ActressSort IntEnum values. */
export const ACTRESS_SORT_BY_VIDEO_CNT = 7;
export const ACTRESS_SORT_BY_SUB_CNT = 8;
export const ACTRESS_SORT_BY_VIEW_CNT = 9;
export const ACTRESS_SORT_BY_ID = 10;

export const ACTRESS_FILTER_OPTIONS_LIMIT = 100;

/** Map UI sort keys to backend numeric sort. */
export function actressSortToApi(sort: ActressSort): number {
  switch (sort) {
    case "most-videos":
      return ACTRESS_SORT_BY_VIDEO_CNT;
    case "most-subscribed":
      return ACTRESS_SORT_BY_SUB_CNT;
    case "most-viewed":
    case "most-likes":
    case "trending-year":
    case "trending-month":
    case "trending-week":
      return ACTRESS_SORT_BY_VIEW_CNT;
    default:
      return ACTRESS_SORT_BY_VIEW_CNT;
  }
}

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
    name: translated !== "" ? translated : item.name,
  };
}

function pickImageUrl(images: ActressImageApi[] | null | undefined): string | undefined {
  if (images == null || images.length === 0) {
    return undefined;
  }

  const byAttr = (attr: string) => images.find((img) => img.attribute.toLowerCase() === attr);

  const preferred = byAttr("avatar") ?? byAttr("default") ?? byAttr("thumbnail") ?? images[0];

  return preferred.url !== "" ? preferred.url : undefined;
}

export function mapActressListItemToSummary(item: ActressListItemApi): ActressSummary {
  const translated = item.aka?.translated_name.trim() ?? "";
  const displayName = translated !== "" ? translated : item.name;
  const videoCount = item.video_cnt ?? 0;
  const totalViews = item.view_cnt ?? 0;
  const subscribers = item.sub_cnt ?? 0;
  const totalLikes = item.like_cnt ?? 0;
  const totalComments = item.comment_cnt ?? 0;

  return {
    id: item.id,
    name: displayName,
    image_url: pickImageUrl(item.image),
    ruby: item.ruby ?? null,
    birthday: item.birthday ?? null,
    bust: item.bust ?? null,
    cup: item.cup ?? null,
    waist: item.waist ?? null,
    hip: item.hip ?? null,
    height: item.height ?? null,
    videoCount,
    totalViews,
    totalLikes,
    totalComments,
    subscribers,
    viewsYear: totalViews,
    viewsMonth: totalViews,
    viewsWeek: totalViews,
    labels: [],
    genres: [],
    makers: [],
  };
}

export async function fetchActressList(params: ActressListQueryParams): Promise<ActressListApiResponse> {
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
      label: params.labels,
      bustMin: params.bustMin,
      bustMax: params.bustMax,
      waistMin: params.waistMin,
      waistMax: params.waistMax,
      hipMin: params.hipMin,
      hipMax: params.hipMax,
      heightMin: params.heightMin,
      heightMax: params.heightMax,
      ageMin: params.ageMin,
      ageMax: params.ageMax,
    },
  });
}

export function filtersToListParams(
  filters: ActressFilters,
): Pick<
  ActressListQueryParams,
  | "cups"
  | "genres"
  | "makers"
  | "labels"
  | "bustMin"
  | "bustMax"
  | "waistMin"
  | "waistMax"
  | "hipMin"
  | "hipMax"
  | "heightMin"
  | "heightMax"
  | "ageMin"
  | "ageMax"
> {
  return {
    cups: filters.cups.length > 0 ? filters.cups : undefined,
    genres: filters.genres.length > 0 ? filters.genres : undefined,
    makers: filters.makers.length > 0 ? filters.makers : undefined,
    labels: filters.labels.length > 0 ? filters.labels : undefined,
    bustMin: filters.bustMin,
    bustMax: filters.bustMax,
    waistMin: filters.waistMin,
    waistMax: filters.waistMax,
    hipMin: filters.hipMin,
    hipMax: filters.hipMax,
    heightMin: filters.heightMin,
    heightMax: filters.heightMax,
    ageMin: filters.ageMin,
    ageMax: filters.ageMax,
  };
}

export async function fetchActressPage(input: {
  page: number;
  pageSize?: number;
  sort?: ActressSort;
  filters?: ActressFilters;
}): Promise<ActressPageResult> {
  const pageSize = input.pageSize ?? ACTRESSES_PAGE_SIZE;
  const sort = input.sort ?? DEFAULT_ACTRESS_SORT;
  const filters = input.filters ?? DEFAULT_ACTRESS_FILTERS;
  const page = Math.max(1, input.page);

  const response = await fetchActressList({
    limit: pageSize,
    page,
    sort: actressSortToApi(sort),
    ...filtersToListParams(filters),
  });

  const total = response.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  return {
    items: response.items.map(mapActressListItemToSummary),
    page: safePage,
    pageSize,
    total,
    totalPages,
    sort,
    filters,
  };
}

export function actressListQueryOptions(input: {
  page: number;
  pageSize?: number;
  sort?: ActressSort;
  filters?: ActressFilters;
}) {
  const pageSize = input.pageSize ?? ACTRESSES_PAGE_SIZE;
  const sort = input.sort ?? DEFAULT_ACTRESS_SORT;
  const filters = input.filters ?? DEFAULT_ACTRESS_FILTERS;
  const page = Math.max(1, input.page);

  const listParams: ActressListQueryParams = {
    limit: pageSize,
    page,
    sort: actressSortToApi(sort),
    ...filtersToListParams(filters),
  };

  return queryOptions({
    queryKey: actressQueryKeys.list(listParams),
    queryFn: () =>
      fetchActressPage({
        page,
        pageSize,
        sort,
        filters,
      }),
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

  return response.items.map(mapActressToNamedEntity);
}

export function actressFilterInfiniteOptions(q?: string) {
  const normalized = q?.trim() ? q.trim() : undefined;

  return infiniteQueryOptions({
    queryKey: actressQueryKeys.filterOptions(normalized),
    queryFn: ({ pageParam }) =>
      fetchActressFilterPage({
        offset: pageParam,
        limit: ACTRESS_FILTER_OPTIONS_LIMIT,
        q: normalized,
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

export function flattenActressFilterPages(pages: ActressListApiResponse[] | undefined): NamedEntity[] {
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
      result.push(mapActressToNamedEntity(item));
    }
  }

  return result;
}

export async function fetchActressDetail(actressId: number) {
  return apiFetch<ActressListItemApi>(`/actresses/${actressId}`);
}

export function actressDetailQueryOptions(actressId: number) {
  return queryOptions({
    queryKey: actressQueryKeys.detail(actressId),
    queryFn: () => fetchActressDetail(actressId),
  });
}
