import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { isAuthBootstrapComplete, runAuthBootstrap } from "@/libs/auth-bootstrap";
import { AUTH_SESSION_ENDED_EVENT, silentRefreshSessionDetailed } from "@/libs/api-client";
import type { UserProfile } from "@/libs/auth";
import { applyAuthSession, subscribeAuthBroadcast } from "@/libs/auth-session";
import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

const BOOTSTRAP_HARD_TIMEOUT_MS = 3_000;
const FOCUS_REVALIDATE_MIN_INTERVAL_MS = 5_000;
const NAV_REVALIDATE_MIN_INTERVAL_MS = 1_500;

function sameUser(a: UserProfile | null | undefined, b: UserProfile | null | undefined): boolean {
  if (a == null && b == null) {
    return true;
  }

  if (a == null || b == null) {
    return false;
  }

  if (a.username === b.username) {
    return true;
  }

  if (a.id.length > 0 && b.id.length > 0 && a.id === b.id) {
    return true;
  }

  return false;
}

/**
 * Client-only silent auth interceptor.
 *
 * Seeds Zustand from SSR-dehydrated query data, then refreshes the access
 * token in the background. When bootstrap upgrades a guest SSR payload to a
 * real session, invalidates the router once so route context (isOwner,
 * requireOwnerBeforeLoad) catches up without a second pending flash.
 *
 * When bootstrap (or a later focus revalidate) learns the session is dead,
 * clears query cache + identity cookie and invalidates the router so header
 * and owner chrome drop to guest immediately.
 */
export function AuthStoreSync() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);
  const lastFocusRevalidateAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    cancelledRef.current = false;

    const ssrUser = queryClient.getQueryData<UserProfile | null>(authMeQueryOptions.queryKey);
    const store = useAuthStore.getState();

    if (ssrUser != null && store.user == null) {
      store.setUser(ssrUser);
    }

    if (ssrUser != null) {
      store.setRestoring(false);
    } else if (store.user == null) {
      store.setRestoring(true);
    }

    if (isAuthBootstrapComplete()) {
      useAuthStore.getState().setRestoring(false);

      return;
    }

    const hardTimeout = window.setTimeout(() => {
      if (cancelledRef.current) {
        return;
      }

      useAuthStore.getState().setRestoring(false);
    }, BOOTSTRAP_HARD_TIMEOUT_MS);

    void (async () => {
      try {
        const seededBefore = useAuthStore.getState().user;
        const result = await runAuthBootstrap();

        if (cancelledRef.current) {
          return;
        }

        if (result.user != null) {
          queryClient.setQueryData(authMeQueryOptions.queryKey, result.user);

          if (!sameUser(seededBefore ?? ssrUser, result.user)) {
            await router.invalidate();
          }
        } else {
          applyAuthSession(queryClient, null);

          if (seededBefore != null || ssrUser != null) {
            await router.invalidate();
          }
        }
      } catch {
        // Bootstrap failures are non-fatal; chrome already has SSR or guest state.
      } finally {
        window.clearTimeout(hardTimeout);
        useAuthStore.getState().setRestoring(false);
      }
    })();

    return () => {
      cancelledRef.current = true;
      window.clearTimeout(hardTimeout);
    };
  }, [queryClient, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    async function endLocalSession() {
      if (cancelled) {
        return;
      }

      applyAuthSession(queryClient, null);
      await router.invalidate();
    }

    async function revalidateSession(minIntervalMs: number) {
      if (cancelled) {
        return;
      }

      if (useAuthStore.getState().user == null) {
        return;
      }

      const now = Date.now();

      if (now - lastFocusRevalidateAtRef.current < minIntervalMs) {
        return;
      }

      lastFocusRevalidateAtRef.current = now;

      const refresh = await silentRefreshSessionDetailed();

      if (refresh.status === "unauthorized") {
        applyAuthSession(queryClient, null);
        await router.invalidate();
      }
    }

    function onVisibilityOrFocus() {
      if (document.visibilityState === "hidden") {
        return;
      }

      void revalidateSession(FOCUS_REVALIDATE_MIN_INTERVAL_MS);
    }

    function onSessionEndedEvent() {
      void endLocalSession();
    }

    const unsubscribeBroadcast = subscribeAuthBroadcast(() => {
      void endLocalSession();
    });

    // Cross-browser revoke-all cannot use BroadcastChannel. Re-check the
    // refresh cookie on every settled navigation so owner chrome drops as
    // soon as the user clicks around, without waiting for focus/tab switch.
    const unsubscribeNav = router.subscribe("onResolved", () => {
      void revalidateSession(NAV_REVALIDATE_MIN_INTERVAL_MS);
    });

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    window.addEventListener(AUTH_SESSION_ENDED_EVENT, onSessionEndedEvent);

    return () => {
      cancelled = true;
      unsubscribeBroadcast();
      unsubscribeNav();
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
      window.removeEventListener(AUTH_SESSION_ENDED_EVENT, onSessionEndedEvent);
    };
  }, [queryClient, router]);

  return null;
}
