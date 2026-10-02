import { create } from "zustand";

import type { UserProfile } from "@/libs/auth";
import {
  clearIdentityUsername,
  writeIdentityUsername,
} from "@/libs/auth-identity-cookie";

type AuthState = {
  user: UserProfile | null;
  /** Short-lived access JWT held in memory only (never localStorage). */
  accessToken: string | null;
  /**
   * True while the client silent-refresh interceptor is resolving the
   * session after a hard reload. Route guards and the header must wait.
   */
  isRestoring: boolean;
  setUser: (user: UserProfile | null) => void;
  setAccessToken: (token: string | null) => void;
  setSession: (user: UserProfile | null, accessToken: string | null) => void;
  setRestoring: (value: boolean) => void;
  clearUser: () => void;
};

/**
 * Synchronous client auth state for UI and API Authorization headers.
 * Access token lives only in process memory. Refresh token is HttpOnly.
 * Never persists to localStorage or sessionStorage.
 *
 * ``isRestoring`` starts true so the header/footer never flash "Sign in"
 * before the silent-refresh interceptor finishes on a hard reload. SSR
 * hydrate and AuthStoreSync clear the flag once the session is known.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isRestoring: true,
  setUser: (user) => {
    if (user?.username) {
      writeIdentityUsername(user.username);
    }

    set({ user });
  },
  setAccessToken: (accessToken) => {
    set({ accessToken });
  },
  setSession: (user, accessToken) => {
    if (user?.username) {
      writeIdentityUsername(user.username);
    } else {
      clearIdentityUsername();
    }

    set({ user, accessToken, isRestoring: false });
  },
  setRestoring: (isRestoring) => {
    set({ isRestoring });
  },
  clearUser: () => {
    clearIdentityUsername();
    set({ user: null, accessToken: null, isRestoring: false });
  },
}));

export function getAuthUser(): UserProfile | null {
  return useAuthStore.getState().user;
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
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
