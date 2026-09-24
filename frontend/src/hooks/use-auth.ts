import { useCallback } from "react";

import type { UserProfile } from "@/libs/auth";
import { logoutUser } from "@/libs/auth";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Auth state and actions from the in-memory Zustand store.
 * Session is the HttpOnly cookie; profile is never persisted to storage.
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Clear memory even if the network call fails.
    }

    clearUser();
  }, [clearUser]);

  const setAuthenticatedUser = useCallback(
    (next: UserProfile | null) => {
      setUser(next);
    },
    [setUser],
  );

  return {
    isAuthenticated: user !== null,
    isPending: status === "pending",
    status,
    user,
    profile: user,
    signOut,
    setUser: setAuthenticatedUser,
  };
}
