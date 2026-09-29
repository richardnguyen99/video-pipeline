import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, setResponseHeader, setResponseHeaders } from "@tanstack/react-start/server";

import type { UserProfile } from "@/libs/auth";
import { HttpStatus } from "@/libs/http-status";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/v1/auth/";

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

type SessionPayload = UserProfile & {
  access_token: string;
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
 * Forward only the refresh ``Set-Cookie`` onto the Start response.
 * Access tokens are never stored as cookies.
 */
function forwardRefreshSetCookie(response: Response): void {
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

  for (const raw of rawList) {
    const parsed = parseSetCookieHeader(raw);

    if (parsed === null) {
      continue;
    }

    if (parsed.name !== REFRESH_TOKEN_COOKIE) {
      continue;
    }

    setCookie(parsed.name, parsed.value, {
      path: parsed.path ?? REFRESH_COOKIE_PATH,
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
    path: REFRESH_COOKIE_PATH,
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

function toUserProfile(session: SessionPayload): UserProfile {
  return {
    id: session.id,
    username: session.username,
    email: session.email,
    display_name: session.display_name,
    is_active: session.is_active,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

async function fetchMeWithBearer(
  accessToken: string,
): Promise<{ ok: true; user: UserProfile } | { ok: false; status: number }> {
  const response = await fetch(getBackendAuthMeUrl(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
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
 * Call backend refresh with the refresh cookie; forward rotated refresh
 * cookie; return the session (including access_token in body for callers
 * that can store it — SSR only uses the profile).
 */
async function refreshAccessTokenFromCookie(): Promise<SessionPayload | null> {
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

  forwardRefreshSetCookie(response);

  return (await response.json()) as SessionPayload;
}

/**
 * Resolve the current user on the server via refresh cookie → Bearer me.
 */
export const fetchAuthMe = createServerFn({ method: "GET" }).handler(async (): Promise<UserProfile | null> => {
  setResponseHeaders(
    new Headers({
      "Cache-Control": "private, no-store",
    }),
  );

  const refresh = getCookie(REFRESH_TOKEN_COOKIE);

  if (refresh == null || refresh.trim() === "") {
    return null;
  }

  const session = await refreshAccessTokenFromCookie();

  if (session === null) {
    return null;
  }

  const me = await fetchMeWithBearer(session.access_token);

  if (me.ok) {
    return me.user;
  }

  return toUserProfile(session);
});

/**
 * Explicitly refresh; returns profile when successful.
 */
export const refreshAuthSession = createServerFn({ method: "POST" }).handler(async (): Promise<UserProfile | null> => {
  setResponseHeader("Cache-Control", "private, no-store");

  try {
    const session = await refreshAccessTokenFromCookie();

    if (session === null) {
      return null;
    }

    return toUserProfile(session);
  } catch {
    return null;
  }
});

/**
 * End the session: revoke on the API and clear cookies on this response.
 */
export const logoutSession = createServerFn({ method: "POST" }).handler(async (): Promise<null> => {
  setResponseHeader("Cache-Control", "private, no-store");

  const refresh = getCookie(REFRESH_TOKEN_COOKIE);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (refresh != null && refresh.trim() !== "") {
    headers.Cookie = `${REFRESH_TOKEN_COOKIE}=${refresh}`;
  }

  try {
    await fetch(getBackendLogoutUrl(), {
      method: "POST",
      headers,
    });
  } catch {
    // Still clear the client cookies below.
  }

  clearAuthCookieHeaders();

  return null;
});
