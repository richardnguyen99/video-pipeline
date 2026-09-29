import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { logoutUser } from "@/libs/auth";
import { applyAuthSession } from "@/libs/auth-session";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Client auth from Zustand (memory access token + profile).
 *
 * Session is established by the silent-auth interceptor (``runAuthBootstrap``)
 * on boot and by login. Query is no longer the source of truth for the header
 * so a dehydrated guest result cannot flash "Sign in" over a restored session.
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const accessToken = useAuthStore((state) => state.accessToken);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Always clear client session so UI reflects guest state.
    }

    applyAuthSession(queryClient, null);
  }, [queryClient]);

  const setAuthenticatedUser = useCallback(
    (next: typeof user) => {
      applyAuthSession(queryClient, next);
    },
    [queryClient],
  );

  return {
    isAuthenticated: user !== null,
    isRestoring,
    hasAccessToken: accessToken != null && accessToken.length > 0,
    user,
    profile: user,
    signOut,
    setUser: setAuthenticatedUser,
  };
}
