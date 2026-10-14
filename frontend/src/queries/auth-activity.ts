import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type UserActivityEventType =
  "login" | "password_change" | "username_change" | "email_change" | "like" | "comment" | "playlist_create";

export type UserActivityItem = {
  id: string;
  event_type: UserActivityEventType | string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  browser_label: string | null;
  created_at: string;
};

export type UserActivityListResponse = {
  items: Array<UserActivityItem>;
  total: number;
  limit: number;
  offset: number;
};

export const authActivityQueryKeys = {
  all: ["auth", "activity"] as const,
  list: (limit: number, offset: number) => [...authActivityQueryKeys.all, "list", limit, offset] as const,
};

export async function fetchAuthActivity(limit = 50, offset = 0): Promise<UserActivityListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return apiFetch<UserActivityListResponse>(`/auth/activity?${params}`);
}

export const authActivityQueryOptions = (limit = 50, offset = 0) =>
  queryOptions({
    queryKey: authActivityQueryKeys.list(limit, offset),
    queryFn: () => fetchAuthActivity(limit, offset),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  });
