import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Mirror the hydrated / live Query session into the Zustand client store.
 *
 * SSR dehydrates Query; Zustand starts empty on the client. Without this
 * sync, the header stays on "Sign in" until an incidental re-render.
 */
export function AuthStoreSync() {
  const { data } = useQuery(authMeQueryOptions);

  useEffect(() => {
    if (data === undefined) {
      return;
    }

    if (data !== null) {
      useAuthStore.getState().setUser(data);
    } else {
      useAuthStore.getState().clearUser();
    }
  }, [data]);

  return null;
}
