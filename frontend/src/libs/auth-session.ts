import type { QueryClient } from "@tanstack/react-query";

import type { UserProfile } from "@/libs/auth";
import { authMeQueryOptions, authQueryKeys } from "@/queries/auth";
import { purgeLegacyAuthStorage, useAuthStore } from "@/stores/auth-store";

export type AuthRouterContext = {
  isAuthenticated: boolean;
  user: UserProfile | null;
};

/**
 * Load session via TanStack Query and mirror into client auth store.
 * Used from root ``beforeLoad`` so route guards see a consistent context.
 */
export async function loadAuthSession(queryClient: QueryClient): Promise<AuthRouterContext> {
  purgeLegacyAuthStorage();

  const user = await queryClient.ensureQueryData(authMeQueryOptions);

  if (user !== null) {
    useAuthStore.getState().setUser(user);
  } else {
    useAuthStore.getState().clearUser();
  }

  return {
    isAuthenticated: user !== null,
    user,
  };
}

/**
 * Apply a known session (login / logout) to Query cache and the Zustand mirror.
 * Cancels any in-flight ``/auth/me`` so a late null response cannot wipe a fresh login.
 */
export function applyAuthSession(queryClient: QueryClient, user: UserProfile | null): void {
  void queryClient.cancelQueries({ queryKey: authQueryKeys.me() });
  queryClient.setQueryData(authMeQueryOptions.queryKey, user);

  if (user !== null) {
    useAuthStore.getState().setUser(user);
  } else {
    useAuthStore.getState().clearUser();
  }
}
