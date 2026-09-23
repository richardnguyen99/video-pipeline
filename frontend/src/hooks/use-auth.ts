import { useCallback, useSyncExternalStore } from "react";

import type { UserProfile } from "@/libs/auth";
import { clearStoredUser, getStoredUser, setStoredUser } from "@/libs/auth-session";

const AUTH_EVENT = "vp-auth-change";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handler);
  window.addEventListener(AUTH_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(AUTH_EVENT, handler);
  };
}

function getSnapshot(): UserProfile | null {
  return getStoredUser();
}

function getServerSnapshot(): UserProfile | null {
  return null;
}

function notifyAuthChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_EVENT));
}

/**
 * Client auth state backed by localStorage (profile only; no JWT yet).
 */
export function useAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signOut = useCallback(() => {
    clearStoredUser();
    notifyAuthChange();
  }, []);

  const setUser = useCallback((next: UserProfile | null) => {
    if (next === null) {
      clearStoredUser();
    } else {
      setStoredUser(next);
    }

    notifyAuthChange();
  }, []);

  return {
    isAuthenticated: user !== null,
    user,
    profile: user,
    signOut,
    setUser,
  };
}
