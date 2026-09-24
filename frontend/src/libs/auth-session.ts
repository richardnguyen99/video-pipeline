import type { QueryClient } from "@tanstack/react-query";

import type { UserProfile } from "@/libs/auth";
import { purgeLegacyAuthStorage, useAuthStore } from "@/stores/auth-store";
import { authMeQueryOptions } from "@/queries/auth";

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

export function applyAuthSession(queryClient: QueryClient, user: UserProfile | null): void {
  queryClient.setQueryData(authMeQueryOptions.queryKey, user);

  if (user !== null) {
    useAuthStore.getState().setUser(user);
  } else {
    useAuthStore.getState().clearUser();
  }
}
