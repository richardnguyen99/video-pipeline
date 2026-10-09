import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type UserSearchItem = {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
};

export type UserSearchPage = {
  items: Array<UserSearchItem>;
};

export const userQueryKeys = {
  all: ["users"] as const,
  search: (query: string, limit: number) => [...userQueryKeys.all, "search", { query, limit }] as const,
};

export async function searchUsers(query: string, options?: { limit?: number }): Promise<UserSearchPage> {
  const limit = options?.limit ?? 10;

  return apiFetch<UserSearchPage>("/users/search", {
    searchParams: { q: query, limit },
  });
}

export function userSearchQueryOptions(query: string, options?: { limit?: number }) {
  const limit = options?.limit ?? 10;
  const trimmed = query.trim();

  return queryOptions({
    queryKey: userQueryKeys.search(trimmed, limit),
    queryFn: () => searchUsers(trimmed, { limit }),
    enabled: trimmed.length >= 1,
    staleTime: 15_000,
  });
}
