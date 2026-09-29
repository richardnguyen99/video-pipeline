/**
 * Single-flight silent authentication bootstrap (hard reload interceptor).
 *
 * Workflow on F5:
 * 1. Memory wiped — accessToken gone.
 * 2. Router beforeLoad / AuthStoreSync calls runAuthBootstrap.
 * 3. If Zustand already has accessToken → skip.
 * 4. Else POST /api/v1/auth/refresh (HttpOnly refresh cookie attached).
 * 5–6. Backend validates + rotates; returns { access_token, ...user }.
 * 7. Hydrate Zustand from the response body.
 * 8. Route guards resolve; UI mounts without a login flash.
 */

import { silentRefreshSession } from "@/libs/api-client";
import type { SessionPayload } from "@/libs/api-client";
import type { UserProfile } from "@/libs/auth";
import { useAuthStore } from "@/stores/auth-store";

export type AuthBootstrapResult = {
  user: UserProfile | null;
  accessToken: string | null;
};

let bootstrapInFlight: Promise<AuthBootstrapResult> | null = null;
let bootstrapCompleted = false;
let lastResult: AuthBootstrapResult = { user: null, accessToken: null };

function sessionToUser(session: SessionPayload): UserProfile {
  return {
    id: session.id,
    username: session.username,
    email: session.email,
    display_name: session.display_name,
    is_active: session.is_active,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

/**
 * Run once per page lifetime (shared by root beforeLoad and AuthStoreSync).
 *
 * Live Zustand sessions (e.g. just after login) win over a stale guest cache.
 */
export async function runAuthBootstrap(): Promise<AuthBootstrapResult> {
  if (typeof window === "undefined") {
    return { user: null, accessToken: null };
  }

  const store = useAuthStore.getState();

  if (store.user !== null && store.accessToken != null && store.accessToken.length > 0) {
    lastResult = { user: store.user, accessToken: store.accessToken };
    bootstrapCompleted = true;
    store.setRestoring(false);

    return lastResult;
  }

  if (bootstrapCompleted) {
    useAuthStore.getState().setRestoring(false);

    return lastResult;
  }

  if (bootstrapInFlight !== null) {
    return bootstrapInFlight;
  }

  bootstrapInFlight = (async (): Promise<AuthBootstrapResult> => {
    useAuthStore.getState().setRestoring(true);

    try {
      const session = await silentRefreshSession();

      if (session === null) {
        lastResult = { user: null, accessToken: null };
        useAuthStore.getState().clearUser();

        return lastResult;
      }

      const user = sessionToUser(session);
      const accessToken = session.access_token;

      useAuthStore.getState().setSession(user, accessToken);
      lastResult = { user, accessToken };

      return lastResult;
    } finally {
      bootstrapCompleted = true;
      bootstrapInFlight = null;
      useAuthStore.getState().setRestoring(false);
    }
  })();

  return bootstrapInFlight;
}

/**
 * Record a known session (login) so later bootstrap/loadAuthSession calls
 * do not overwrite it with a stale guest result.
 */
export function markAuthBootstrapSession(user: UserProfile, accessToken: string): void {
  lastResult = { user, accessToken };
  bootstrapCompleted = true;
  bootstrapInFlight = null;
  useAuthStore.getState().setSession(user, accessToken);
  useAuthStore.getState().setRestoring(false);
}

/** Reset after logout so the next visit can bootstrap again. */
export function resetAuthBootstrap(): void {
  bootstrapCompleted = false;
  bootstrapInFlight = null;
  lastResult = { user: null, accessToken: null };
}

export function getAuthBootstrapSnapshot(): AuthBootstrapResult {
  return lastResult;
}

export function isAuthBootstrapComplete(): boolean {
  return typeof window === "undefined" || bootstrapCompleted;
}
