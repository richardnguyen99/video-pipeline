/**
 * Client-side session helpers for the authenticated user profile.
 * Access JWT lives in an HttpOnly cookie; profile is mirrored here for UI.
 */

import type { UserProfile } from "@/libs/auth";

const STORAGE_KEY = "vp.auth.user";

let cachedRaw: string | null | undefined;
let cachedUser: UserProfile | null = null;

function readRaw(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = readRaw();

  if (raw === cachedRaw) {
    return cachedUser;
  }

  cachedRaw = raw;

  if (!raw) {
    cachedUser = null;

    return null;
  }

  try {
    cachedUser = JSON.parse(raw) as UserProfile;
  } catch {
    cachedUser = null;
  }

  return cachedUser;
}

export function setStoredUser(user: UserProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  const raw = JSON.stringify(user);

  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedUser = user;
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedUser = null;
}
