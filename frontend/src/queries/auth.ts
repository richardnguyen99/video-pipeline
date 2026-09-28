import { queryOptions } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/libs/api-client";
import type { UserProfile } from "@/libs/auth";
import { HttpStatus } from "@/libs/http-status";
import { fetchAuthMe } from "@/server/auth.functions";

export const authQueryKeys = {
  all: ["auth"] as const,
  me: () => [...authQueryKeys.all, "me"] as const,
};

/**
 * Resolve the current session on the browser via the Vite ``/api`` proxy so
 * ``Set-Cookie`` from login/refresh is applied by the browser (both access
 * and refresh). ``apiFetch`` already performs a single-flight refresh on 401.
 *
 * SSR still uses the Start server function, which forwards cookies with
 * ``setCookie`` for each token.
 */
async function fetchAuthMeOnClient(): Promise<UserProfile | null> {
  try {
    return await apiFetch<UserProfile>("/auth/me", {
      method: "GET",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === HttpStatus.UNAUTHORIZED) {
      return null;
    }

    return null;
  }
}

/**
 * Current session user from the HttpOnly cookies.
 *
 * Browser: same-origin ``/api/v1`` (proxy) so rotated cookies stick.
 * SSR: Start server function with explicit ``setCookie`` forwarding.
 */
export const authMeQueryOptions = queryOptions({
  queryKey: authQueryKeys.me(),
  queryFn: async (): Promise<UserProfile | null> => {
    if (typeof window !== "undefined") {
      return fetchAuthMeOnClient();
    }

    return fetchAuthMe();
  },
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: false,
  refetchOnWindowFocus: true,
});
