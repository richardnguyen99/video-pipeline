import type { QueryClient } from "@tanstack/react-query";

import { resetAuthBootstrap, markAuthBootstrapSession } from "@/libs/auth-bootstrap";
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
export async function loadAuthSession(queryClient: QueryClient): Promise<AuthRouterContext> {
  purgeLegacyAuthStorage();

  if (typeof window === "undefined") {
    try {
      const user = await fetchAuthMe();

      // Always seed the me query (including null) so client hydrate can trust
      // an SSR guest verdict and skip the auth-restoring placeholder.
      queryClient.setQueryData(authMeQueryOptions.queryKey, user);

      return {
        isAuthenticated: user != null,
        user,
        isReady: true,
      };
    } catch {
      queryClient.setQueryData(authMeQueryOptions.queryKey, null);

      return {
        isAuthenticated: false,
        user: null,
        isReady: true,
      };
    }
  }

  const store = useAuthStore.getState();

  // Settled guest after clearUser / session-ended: never rehydrate from
  // query cache or identity cookie. Client navigation must stay guest.
  if (!store.isRestoring && store.user == null) {
    queryClient.setQueryData(authMeQueryOptions.queryKey, null);

    return {
      isAuthenticated: false,
      user: null,
      isReady: true,
    };
  }

  if (store.user !== null && store.accessToken != null && store.accessToken.length > 0) {
    queryClient.setQueryData(authMeQueryOptions.queryKey, store.user);
    store.setRestoring(false);

    return {
      isAuthenticated: true,
      user: store.user,
      isReady: true,
    };
  }

  const cachedUser = queryClient.getQueryData<UserProfile | null>(authMeQueryOptions.queryKey);

  if (cachedUser != null && store.user != null) {
    return {
      isAuthenticated: true,
      user: store.user,
      isReady: true,
    };
  }

  if (cachedUser != null && store.isRestoring) {
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

  // Identity cookie is only a first-paint hint while bootstrap is still
  // restoring. Once the store is empty after a completed restore, do not
  // rehydrate a dead session from the hint alone.
  const identityUsername = readIdentityUsername();

  if (store.isRestoring && identityUsername != null && identityUsername.length > 0) {
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

  // Guest for routing. SSR already seeds auth/me as null when resolved; the
  // client bootstrap may still upgrade via silent refresh without blocking UI.
  return {
    isAuthenticated: false,
    user: null,
    isReady: true,
  };
}

function clearUserScopedQueries(queryClient: QueryClient): void {
  void queryClient.removeQueries({ queryKey: ["playlists"] });
  void queryClient.removeQueries({ queryKey: ["videos", "watched"] });
  void queryClient.removeQueries({ queryKey: ["video-reaction"] });
  void queryClient.removeQueries({ queryKey: ["auth", "sessions"] });
}

/**
 * Apply a known session (login / logout) to Query cache and the Zustand mirror.
 */
export function applyAuthSession(
  queryClient: QueryClient,
  user: UserProfile | null,
  accessToken?: string | null,
): void {
  const previousUserId = useAuthStore.getState().user?.id ?? null;
  const nextUserId = user?.id ?? null;
  const sessionChanged = previousUserId !== nextUserId;

  void queryClient.cancelQueries({ queryKey: authQueryKeys.me() });

  if (user === null || sessionChanged) {
    clearUserScopedQueries(queryClient);
  }

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
    broadcastAuthMessage({ type: "session-ended" });
  }
}

const AUTH_BROADCAST_CHANNEL = "velvet-auth";

export type AuthBroadcastMessage = {
  type: "session-ended";
};

let authBroadcastChannel: BroadcastChannel | null = null;

function getAuthBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }

  if (authBroadcastChannel == null) {
    authBroadcastChannel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
  }

  return authBroadcastChannel;
}

function broadcastAuthMessage(message: AuthBroadcastMessage): void {
  try {
    getAuthBroadcastChannel()?.postMessage(message);
  } catch {
    // BroadcastChannel can throw in private modes; ignore.
  }
}

/** Notify other same-origin tabs that the local session ended. */
export function notifyAuthSessionEnded(): void {
  broadcastAuthMessage({ type: "session-ended" });
}

/**
 * Subscribe to cross-tab session-ended messages (same browser origin).
 */
export function subscribeAuthBroadcast(onMessage: (message: AuthBroadcastMessage) => void): () => void {
  const channel = getAuthBroadcastChannel();

  if (channel == null) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    const payload = event.data as { type?: string } | null | undefined;

    if (payload == null || payload.type !== "session-ended") {
      return;
    }

    onMessage({ type: "session-ended" });
  };

  channel.addEventListener("message", handler);

  return () => {
    channel.removeEventListener("message", handler);
  };
}
