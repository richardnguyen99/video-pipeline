import { createServerFn } from "@tanstack/react-start";
import { getCookie, setResponseHeader } from "@tanstack/react-start/server";

import type { UserProfile } from "@/libs/auth";
import { HttpStatus } from "@/libs/http-status";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

function getBackendOrigin(): string {
  const fromApiBase = process.env.VITE_API_BASE_URL?.trim();

  if (fromApiBase) {
    return fromApiBase.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  }

  return (process.env.VITE_BACKEND_ORIGIN?.trim() || "http://localhost:8000").replace(/\/$/, "");
}

function getBackendAuthMeUrl(): string {
  return `${getBackendOrigin()}/api/v1/auth/me`;
}

function getBackendLogoutUrl(): string {
  return `${getBackendOrigin()}/api/v1/auth/logout`;
}

function getBackendRefreshUrl(): string {
  return `${getBackendOrigin()}/api/v1/auth/refresh`;
}

/**
 * Expire access and refresh cookies on the Start response so the browser
 * drops them for the app origin (works with Vite proxy and SSR RPC).
 *
 * Each cookie needs its own ``Set-Cookie`` header (they cannot be merged).
 */
function clearAuthCookieHeaders(): void {
  setResponseHeader("Set-Cookie", `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  setResponseHeader("Set-Cookie", `${REFRESH_TOKEN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

/**
 * Forward ``Set-Cookie`` values from the backend onto the Start response so
 * the browser updates host-only cookies on the app origin.
 */
function forwardSetCookieHeaders(response: Response): void {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookies =
    typeof headersWithGetSetCookie.getSetCookie === "function" ? headersWithGetSetCookie.getSetCookie() : [];

  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      setResponseHeader("Set-Cookie", cookie);
    }

    return;
  }

  const single = response.headers.get("set-cookie");

  if (single != null && single.trim() !== "") {
    setResponseHeader("Set-Cookie", single);
  }
}

function buildCookieHeader(): string | null {
  const parts: string[] = [];
  const access = getCookie(ACCESS_TOKEN_COOKIE);
  const refresh = getCookie(REFRESH_TOKEN_COOKIE);

  if (access != null && access.trim() !== "") {
    parts.push(`${ACCESS_TOKEN_COOKIE}=${access}`);
  }

  if (refresh != null && refresh.trim() !== "") {
    parts.push(`${REFRESH_TOKEN_COOKIE}=${refresh}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join("; ");
}

async function fetchMeWithAccessCookie(
  accessToken: string,
): Promise<{ ok: true; user: UserProfile } | { ok: false; status: number }> {
  const response = await fetch(getBackendAuthMeUrl(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
    },
  });

  if (response.status === HttpStatus.UNAUTHORIZED) {
    return { ok: false, status: response.status };
  }

  if (!response.ok) {
    throw new Error(`Auth session check failed with status ${response.status}`);
  }

  return {
    ok: true,
    user: (await response.json()) as UserProfile,
  };
}

/**
 * Call the backend refresh endpoint with the refresh cookie and forward any
 * rotated access/refresh ``Set-Cookie`` headers onto the Start response.
 *
 * The backend consumes the previous refresh ``jti`` in Redis (one-time use).
 */
async function refreshAccessTokenFromCookie(): Promise<UserProfile | null> {
  const refresh = getCookie(REFRESH_TOKEN_COOKIE);

  if (refresh == null || refresh.trim() === "") {
    return null;
  }

  const response = await fetch(getBackendRefreshUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: `${REFRESH_TOKEN_COOKIE}=${refresh}`,
    },
  });

  if (response.status === HttpStatus.UNAUTHORIZED) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Auth refresh failed with status ${response.status}`);
  }

  forwardSetCookieHeaders(response);

  return (await response.json()) as UserProfile;
}

/**
 * Resolve the current user on the server using the HttpOnly access cookie.
 *
 * When the access token is missing or rejected, attempts one refresh using
 * the refresh cookie so long-lived sessions survive access expiry across
 * SSR and client navigations.
 */
export const fetchAuthMe = createServerFn({ method: "GET" }).handler(async (): Promise<UserProfile | null> => {
  setResponseHeader("Cache-Control", "private, no-store");

  const access = getCookie(ACCESS_TOKEN_COOKIE);
  const refresh = getCookie(REFRESH_TOKEN_COOKIE);

  if ((access == null || access.trim() === "") && (refresh == null || refresh.trim() === "")) {
    return null;
  }

  if (access != null && access.trim() !== "") {
    const result = await fetchMeWithAccessCookie(access);

    if (result.ok) {
      return result.user;
    }
  }

  const refreshed = await refreshAccessTokenFromCookie();

  if (refreshed !== null) {
    return refreshed;
  }

  return null;
});

/**
 * Explicitly refresh the access token from the refresh cookie.
 * Returns the user profile when successful, otherwise ``null``.
 */
export const refreshAuthSession = createServerFn({ method: "POST" }).handler(async (): Promise<UserProfile | null> => {
  setResponseHeader("Cache-Control", "private, no-store");

  try {
    return await refreshAccessTokenFromCookie();
  } catch {
    return null;
  }
});

/**
 * End the session: revoke on the API and clear HttpOnly cookies on
 * this response so the browser drops them immediately.
 */
export const logoutSession = createServerFn({ method: "POST" }).handler(async (): Promise<null> => {
  setResponseHeader("Cache-Control", "private, no-store");

  const cookieHeader = buildCookieHeader();

  if (cookieHeader != null) {
    try {
      await fetch(getBackendLogoutUrl(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Cookie: cookieHeader,
        },
      });
    } catch {
      // Still clear the client cookies below.
    }
  }

  clearAuthCookieHeaders();

  return null;
});
