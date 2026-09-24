import { queryOptions } from "@tanstack/react-query";

import type { UserProfile } from "@/libs/auth";
import { fetchAuthMe } from "@/server/auth.functions";

export const authQueryKeys = {
  all: ["auth"] as const,
  me: () => [...authQueryKeys.all, "me"] as const,
};

/**
 * Current session user from the HttpOnly cookie.
 *
 * Query runs through a Start server function so SSR and client both
 * forward the ``access_token`` cookie to the API (see TanStack Start
 * Query guide — privileged reads belong in server functions).
 */
export const authMeQueryOptions = queryOptions({
  queryKey: authQueryKeys.me(),
  queryFn: async (): Promise<UserProfile | null> => {
    return fetchAuthMe();
  },
  staleTime: 0,
  gcTime: 5 * 60_000,
  retry: false,
  refetchOnWindowFocus: true,
});
