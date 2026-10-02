import { queryOptions } from "@tanstack/react-query";

import { runAuthBootstrap } from "@/libs/auth-bootstrap";
import type { UserProfile } from "@/libs/auth";
import { fetchAuthMe } from "@/server/auth.functions";

export const authQueryKeys = {
  all: ["auth"] as const,
  me: () => [...authQueryKeys.all, "me"] as const,
};

/**
 * Current session user.
 *
 * Browser: delegates to the silent-auth interceptor (``runAuthBootstrap``).
 * SSR: server function reads the HttpOnly refresh cookie (Path=/) and
 * resolves the profile so owner vs guest chrome can paint without a flash.
 */
export const authMeQueryOptions = queryOptions({
  queryKey: authQueryKeys.me(),
  queryFn: async (): Promise<UserProfile | null> => {
    if (typeof window !== "undefined") {
      const result = await runAuthBootstrap();

      return result.user;
    }

    return fetchAuthMe();
  },
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});
