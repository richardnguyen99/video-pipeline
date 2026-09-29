import type { QueryClient } from "@tanstack/react-query";

import { runAuthBootstrap, resetAuthBootstrap, markAuthBootstrapSession } from "@/libs/auth-bootstrap";
import type { UserProfile } from "@/libs/auth";
import { authMeQueryOptions, authQueryKeys } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

const LEGACY_AUTH_STORAGE_KEY = "velvet-auth";

function purgeLegacyAuthStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

export type AuthRouterContext = {
  isAuthenticated: boolean;
  user: UserProfile | null;
  /**
   * False until the client silent-refresh interceptor finishes.
   * SSR is never authoritative (path-scoped refresh cookie is invisible).
   */
  isReady: boolean;
};

/**
 * Root ``beforeLoad`` session loader — implements the hard-reload workflow.
 *
 * Browser:
 *   1. If Zustand already has accessToken → use it (post-login).
 *   2. Else runAuthBootstrap → POST /auth/refresh → hydrate store.
 * SSR:
 *   Always guest + isReady false so client beforeLoad / AuthStoreSync
 *   complete the interceptor before guards redirect.
 */
export async function loadAuthSession(queryClient: QueryClient): Promise<AuthRouterContext> {
  purgeLegacyAuthStorage();

  if (typeof window === "undefined") {
    return {
      isAuthenticated: false,
      user: null,
      isReady: false,
    };
  }

  const store = useAuthStore.getState();

  if (store.user !== null && store.accessToken != null && store.accessToken.length > 0) {
    queryClient.setQueryData(authMeQueryOptions.queryKey, store.user);
    store.setRestoring(false);

    return {
      isAuthenticated: true,
      user: store.user,
      isReady: true,
    };
  }

  const result = await runAuthBootstrap();

  queryClient.setQueryData(authMeQueryOptions.queryKey, result.user);

  if (result.user !== null && result.accessToken != null) {
    useAuthStore.getState().setSession(result.user, result.accessToken);
  } else {
    const stillLive = useAuthStore.getState();

    if (stillLive.user !== null && stillLive.accessToken != null && stillLive.accessToken.length > 0) {
      queryClient.setQueryData(authMeQueryOptions.queryKey, stillLive.user);

      return {
        isAuthenticated: true,
        user: stillLive.user,
        isReady: true,
      };
    }

    useAuthStore.getState().clearUser();
  }

  return {
    isAuthenticated: result.user !== null,
    user: result.user,
    isReady: true,
  };
}

/**
 * Apply a known session (login / logout) to Query cache and the Zustand mirror.
 */
export function applyAuthSession(
  queryClient: QueryClient,
  user: UserProfile | null,
  accessToken?: string | null,
): void {
  void queryClient.cancelQueries({ queryKey: authQueryKeys.me() });

  if (user !== null) {
    queryClient.setQueryData(authMeQueryOptions.queryKey, user);

    if (accessToken != null && accessToken.length > 0) {
      markAuthBootstrapSession(user, accessToken);
    } else {
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setRestoring(false);
    }
  } else {
    resetAuthBootstrap();
    queryClient.removeQueries({ queryKey: authQueryKeys.me() });
    queryClient.setQueryData(authMeQueryOptions.queryKey, null);
    useAuthStore.getState().clearUser();
  }
}
