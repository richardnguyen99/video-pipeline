import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { isAuthBootstrapComplete, runAuthBootstrap } from "@/libs/auth-bootstrap";
import type { UserProfile } from "@/libs/auth";
import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

const BOOTSTRAP_HARD_TIMEOUT_MS = 3_000;

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
 */
export function AuthStoreSync() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

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
        const result = await Promise.race([
          runAuthBootstrap(),
          new Promise<{ user: null; accessToken: null }>((resolve) => {
            window.setTimeout(() => {
              resolve({ user: null, accessToken: null });
            }, BOOTSTRAP_HARD_TIMEOUT_MS);
          }),
        ]);

        if (cancelledRef.current) {
          return;
        }

        if (result.user != null) {
          queryClient.setQueryData(authMeQueryOptions.queryKey, result.user);

          if (!sameUser(seededBefore ?? ssrUser, result.user)) {
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

  return null;
}
