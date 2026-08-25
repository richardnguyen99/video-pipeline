import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type ActressListApiResponse = {
  items: unknown[];
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

export const actressQueryKeys = {
  all: ["actresses"] as const,
  lists: () => [...actressQueryKeys.all, "list"] as const,
  list: (params: ActressListQueryParams) => [...actressQueryKeys.lists(), params] as const,
  details: () => [...actressQueryKeys.all, "detail"] as const,
  detail: (actressId: number) => [...actressQueryKeys.details(), actressId] as const,
};

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

export async function fetchActressById(actressId: number) {
  return apiFetch<unknown>(`/actresses/${actressId}`);
}

export function actressListQueryOptions(params: ActressListQueryParams) {
  return queryOptions({
    queryKey: actressQueryKeys.list(params),
    queryFn: () => fetchActressList(params),
  });
}

export function actressDetailQueryOptions(actressId: number) {
  return queryOptions({
    queryKey: actressQueryKeys.detail(actressId),
    queryFn: () => fetchActressById(actressId),
  });
}
