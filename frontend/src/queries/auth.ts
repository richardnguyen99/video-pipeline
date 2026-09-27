import { queryOptions } from "@tanstack/react-query";

import type { UserProfile } from "@/libs/auth";
import { fetchAuthMe } from "@/server/auth.functions";

export const authQueryKeys = {
  all: ["auth"] as const,
  me: () => [...authQueryKeys.all, "me"] as const,
};

/**
 * Current session user from the HttpOnly cookies.
 *
 * Query runs through a Start server function so SSR and client both
 * forward cookies to the API. When the access token is expired, the
 * server function attempts one refresh before returning null.
 */
export const authMeQueryOptions = queryOptions({
  queryKey: authQueryKeys.me(),
  queryFn: async (): Promise<UserProfile | null> => {
    return fetchAuthMe();
  },
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: false,
  refetchOnWindowFocus: true,
});
