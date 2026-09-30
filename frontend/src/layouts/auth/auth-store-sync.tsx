import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { isAuthBootstrapComplete, runAuthBootstrap } from "@/libs/auth-bootstrap";
import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Client-only silent auth interceptor (backup when root beforeLoad did not
 * re-run after SSR hydration).
 *
 * Runs at most once per mount. After bootstrap, invalidates the router so
 * ``beforeLoad`` guards re-evaluate with ``isReady`` — no layout-level
 * ``navigate`` calls.
 */
export function AuthStoreSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
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

    if (isAuthBootstrapComplete()) {
      useAuthStore.getState().setRestoring(false);

      return;
    }

    void (async () => {
      try {
        const result = await runAuthBootstrap();

        if (cancelledRef.current) {
          return;
        }

        queryClient.setQueryData(authMeQueryOptions.queryKey, result.user);
        await router.invalidate();
      } catch {
        if (cancelledRef.current) {
          return;
        }

        useAuthStore.getState().clearUser();
        useAuthStore.getState().setRestoring(false);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [queryClient, router]);

  return null;
}
