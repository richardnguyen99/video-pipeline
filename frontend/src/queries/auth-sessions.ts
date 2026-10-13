import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type AuthSessionItem = {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  browser_label: string;
  location: string | null;
  last_logged_in: string;
  is_current: boolean;
};

export type AuthSessionListResponse = {
  items: Array<AuthSessionItem>;
};

export const authSessionQueryKeys = {
  all: ["auth", "sessions"] as const,
  list: () => [...authSessionQueryKeys.all, "list"] as const,
};

export async function fetchAuthSessions(): Promise<AuthSessionListResponse> {
  return apiFetch<AuthSessionListResponse>("/auth/sessions");
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  await apiFetch<void>(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function revokeAllAuthSessions(): Promise<void> {
  await apiFetch<void>("/auth/sessions/revoke-all", {
    method: "POST",
  });
}

export const authSessionsQueryOptions = queryOptions({
  queryKey: authSessionQueryKeys.list(),
  queryFn: fetchAuthSessions,
  staleTime: 5_000,
  gcTime: 5 * 60_000,
  retry: false,
  refetchOnWindowFocus: true,
  refetchOnMount: "always",
});
