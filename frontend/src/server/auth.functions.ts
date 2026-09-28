import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, setResponseHeader, setResponseHeaders } from "@tanstack/react-start/server";

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

type ParsedSetCookie = {
  name: string;
  value: string;
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

/**
 * Parse a single ``Set-Cookie`` header value into name/value/attributes.
 */
function parseSetCookieHeader(raw: string): ParsedSetCookie | null {
  const segments = raw.split(";").map((part) => part.trim());

  if (segments.length === 0) {
    return null;
  }

  const [nameValue, ...attributes] = segments;
  const eq = nameValue.indexOf("=");

  if (eq <= 0) {
    return null;
  }

  const name = nameValue.slice(0, eq).trim();
  const value = nameValue.slice(eq + 1).trim();

  if (!name) {
    return null;
  }

  const parsed: ParsedSetCookie = { name, value };

  for (const attr of attributes) {
    const lower = attr.toLowerCase();

    if (lower === "httponly") {
      parsed.httpOnly = true;
      continue;
    }

    if (lower === "secure") {
      parsed.secure = true;
      continue;
    }

    if (lower.startsWith("path=")) {
      parsed.path = attr.slice(5).trim() || "/";
      continue;
    }

    if (lower.startsWith("max-age=")) {
      const maxAge = Number.parseInt(attr.slice(8).trim(), 10);

      if (!Number.isNaN(maxAge)) {
        parsed.maxAge = maxAge;
      }

      continue;
    }

    if (lower.startsWith("samesite=")) {
      const sameSite = attr.slice(9).trim().toLowerCase();

      if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
        parsed.sameSite = sameSite;
      }
    }
  }

  return parsed;
}

/**
 * Apply backend ``Set-Cookie`` headers onto the Start response.
 *
 * Uses ``setCookie`` per cookie so both access and refresh survive (raw
 * ``setResponseHeader('Set-Cookie', ...)`` overwrites previous values).
 */
function forwardSetCookieHeaders(response: Response): void {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookies =
    typeof headersWithGetSetCookie.getSetCookie === "function" ? headersWithGetSetCookie.getSetCookie() : [];

  const rawList =
    setCookies.length > 0
      ? setCookies
      : (() => {
          const single = response.headers.get("set-cookie");

          return single != null && single.trim() !== "" ? [single] : [];
        })();

  const parsedCookies: ParsedSetCookie[] = [];

  for (const raw of rawList) {
    const parsed = parseSetCookieHeader(raw);

    if (parsed !== null) {
      parsedCookies.push(parsed);
    }
  }

  // Apply refresh before access. TanStack Start has historically kept only
  // the last ``setCookie`` call; the access cookie must stick so the next
  // ``/auth/me`` does not re-enter refresh rotation.
  parsedCookies.sort((a, b) => {
    if (a.name === ACCESS_TOKEN_COOKIE) {
      return 1;
    }

    if (b.name === ACCESS_TOKEN_COOKIE) {
      return -1;
    }

    return 0;
  });

  for (const parsed of parsedCookies) {
    setCookie(parsed.name, parsed.value, {
      path: parsed.path ?? "/",
      maxAge: parsed.maxAge,
      httpOnly: parsed.httpOnly ?? true,
      secure: parsed.secure ?? false,
      sameSite: parsed.sameSite ?? "lax",
    });
  }
}

function clearAuthCookieHeaders(): void {
  setCookie(ACCESS_TOKEN_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  setCookie(REFRESH_TOKEN_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
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
  setResponseHeaders(
    new Headers({
      "Cache-Control": "private, no-store",
    }),
  );

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
