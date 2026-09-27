import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { UserProfile } from "@/libs/auth";
import { logoutUser } from "@/libs/auth";
import { applyAuthSession } from "@/libs/auth-session";
import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Client auth mirror + logout.
 *
 * Session authority is TanStack Query (``authMeQueryOptions``). Zustand is a
 * synchronous mirror for UI; Query supplies the value on first paint after
 * SSR hydration so the header does not flash "Sign in".
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const storeUser = useAuthStore((state) => state.user);
  const { data: queryUser } = useQuery(authMeQueryOptions);

  const user: UserProfile | null = storeUser ?? (queryUser === undefined ? null : queryUser);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Always clear client session so UI reflects guest state even when
      // the network call fails (offline, already expired cookie, etc.).
    }

    applyAuthSession(queryClient, null);
  }, [queryClient]);

  const setAuthenticatedUser = useCallback(
    (next: UserProfile | null) => {
      applyAuthSession(queryClient, next);
    },
    [queryClient],
  );

  return {
    isAuthenticated: user !== null,
    user,
    profile: user,
    signOut,
    setUser: setAuthenticatedUser,
  };
}
