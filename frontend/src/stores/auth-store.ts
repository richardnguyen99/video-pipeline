import { create } from "zustand";

import type { UserProfile } from "@/libs/auth";

type AuthState = {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  clearUser: () => void;
};

/**
 * Synchronous client mirror of the authenticated profile for UI.
 * Session authority is the HttpOnly cookie + TanStack Query (``authMeQueryOptions``).
 * Never persists to localStorage or sessionStorage.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => {
    set({ user });
  },
  clearUser: () => {
    set({ user: null });
  },
}));

export function getAuthUser(): UserProfile | null {
  return useAuthStore.getState().user;
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().user !== null;
}

/** Remove any legacy auth keys left in browser storage. */
export function purgeLegacyAuthStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem("vp.auth");
    window.localStorage.removeItem("vp.auth.user");
    window.sessionStorage.removeItem("vp.auth");
    window.sessionStorage.removeItem("vp.auth.user");
  } catch {
    // Storage may be unavailable (private mode, policy).
  }
}
