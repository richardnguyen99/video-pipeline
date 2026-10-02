import type { QueryClient } from "@tanstack/react-query";

import {
  resetAuthBootstrap,
  markAuthBootstrapSession,
} from "@/libs/auth-bootstrap";
import type { UserProfile } from "@/libs/auth";
import { readIdentityUsername } from "@/libs/auth-identity-cookie";
import { authMeQueryOptions, authQueryKeys } from "@/queries/auth";
import { fetchAuthMe } from "@/server/auth.functions";
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
   * Always true after ``loadAuthSession`` returns. Client token refresh runs
   * in the background via ``AuthStoreSync`` and must not block routing.
   */
  isReady: boolean;
};

/**
 * Root ``beforeLoad`` session loader.
 *
 * SSR: resolve the user from the HttpOnly refresh cookie so owner vs guest
 * chrome is correct in the first HTML payload.
 *
 * Browser: synchronous only — read Zustand / dehydrated query cache. Never
 * await network here; a hung ``/auth/refresh`` must not block navigations or
 * keep content suspended. Access-token bootstrap belongs in ``AuthStoreSync``.
 */
export async function loadAuthSession(
  queryClient: QueryClient,
): Promise<AuthRouterContext> {
  purgeLegacyAuthStorage();

  if (typeof window === "undefined") {
    try {
      const user = await fetchAuthMe();

      if (user != null) {
        queryClient.setQueryData(authMeQueryOptions.queryKey, user);
      }

      return {
        isAuthenticated: user != null,
        user,
        isReady: true,
      };
    } catch {
      return {
        isAuthenticated: false,
        user: null,
        isReady: true,
      };
    }
  }

  const store = useAuthStore.getState();

  if (
    store.user !== null &&
    store.accessToken != null &&
    store.accessToken.length > 0
  ) {
    queryClient.setQueryData(authMeQueryOptions.queryKey, store.user);
    store.setRestoring(false);

    return {
      isAuthenticated: true,
      user: store.user,
      isReady: true,
    };
  }

  const cachedUser = queryClient.getQueryData<UserProfile | null>(
    authMeQueryOptions.queryKey,
  );

  if (cachedUser != null) {
    if (store.user == null) {
      store.setUser(cachedUser);
    }

    return {
      isAuthenticated: true,
      user: cachedUser,
      isReady: true,
    };
  }

  if (store.user !== null) {
    queryClient.setQueryData(authMeQueryOptions.queryKey, store.user);

    return {
      isAuthenticated: true,
      user: store.user,
      isReady: true,
    };
  }

  const identityUsername = readIdentityUsername();

  if (identityUsername != null && identityUsername.length > 0) {
    const hintUser: UserProfile = {
      id: "",
      username: identityUsername,
      email: "",
      display_name: null,
      is_active: true,
      email_verified: false,
      created_at: "",
      updated_at: "",
    };

    store.setUser(hintUser);

    return {
      isAuthenticated: true,
      user: hintUser,
      isReady: true,
    };
  }

  // Guest for routing, but keep isRestoring true so the header does not
  // flash "Sign in" until AuthStoreSync finishes the silent refresh.
  return {
    isAuthenticated: false,
    user: null,
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
