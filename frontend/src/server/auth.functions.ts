import { createServerFn } from "@tanstack/react-start";
import { getCookie, setResponseHeader } from "@tanstack/react-start/server";

import type { UserProfile } from "@/libs/auth";

const ACCESS_TOKEN_COOKIE = "access_token";

function getBackendAuthMeUrl(): string {
  const fromApiBase = process.env.VITE_API_BASE_URL?.trim();

  if (fromApiBase) {
    return `${fromApiBase.replace(/\/$/, "")}/auth/me`;
  }

  const origin = process.env.VITE_BACKEND_ORIGIN?.trim() || "http://localhost:8000";

  return `${origin.replace(/\/$/, "")}/api/v1/auth/me`;
}

/**
 * Resolve the current user on the server using the HttpOnly access cookie.
 *
 * Used by TanStack Query during SSR and client navigations (via Start RPC)
 * so the cookie is always available — plain ``fetch`` from Node does not
 * receive browser cookies automatically.
 */
export const fetchAuthMe = createServerFn({ method: "GET" }).handler(async (): Promise<UserProfile | null> => {
  setResponseHeader("Cache-Control", "private, no-store");

  const token = getCookie(ACCESS_TOKEN_COOKIE);

  if (token == null || token.trim() === "") {
    return null;
  }

  const response = await fetch(getBackendAuthMeUrl(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: `${ACCESS_TOKEN_COOKIE}=${token}`,
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Auth session check failed with status ${response.status}`);
  }

  return (await response.json()) as UserProfile;
});
