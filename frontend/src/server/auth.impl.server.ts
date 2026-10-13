import {
  getCookie,
  getRequest,
  getRequestHeader,
  setCookie,
  setResponseHeader,
  setResponseHeaders,
} from "@tanstack/react-start/server";

import type { UserProfile } from "@/libs/auth";
import { IDENTITY_COOKIE, parseIdentityUsernameFromHeader } from "@/libs/auth-identity-cookie";
import { HttpStatus } from "@/libs/http-status";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const REFRESH_COOKIE_PATH = "/";
const BACKEND_FETCH_TIMEOUT_MS = 5_000;
const SSR_TOKEN_TTL_MS = 30_000;

const ssrAccessTokenByRefresh = new Map<string, { token: string; expiresAt: number }>();

function parseRefreshTokenFromCookieHeader(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }

  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf("=");

    if (eq <= 0) {
      continue;
    }

    const name = part.slice(0, eq).trim();

    if (name !== REFRESH_TOKEN_COOKIE) {
      continue;
    }

    const value = part.slice(eq + 1).trim();

    return value.length > 0 ? value : null;
  }

  return null;
}

function readRawCookieHeader(cookieHeader?: string | null): string | null {
  if (cookieHeader != null && cookieHeader.trim() !== "") {
    return cookieHeader;
  }

  try {
    const request = getRequest();
    const fromRequest = request.headers.get("cookie");

    if (fromRequest != null && fromRequest.trim() !== "") {
      return fromRequest;
    }
  } catch {
    // getRequest() may throw outside a request context.
  }

  const fromHeader = getRequestHeader("cookie");

  if (fromHeader != null && fromHeader.trim() !== "") {
    return fromHeader;
  }

  return null;
}

function readRefreshTokenFromRequest(cookieHeader?: string | null): string | null {
  const fromHelper = getCookie(REFRESH_TOKEN_COOKIE);

  if (fromHelper != null && fromHelper.trim() !== "") {
    return fromHelper.trim();
  }

  const raw = readRawCookieHeader(cookieHeader);

  return parseRefreshTokenFromCookieHeader(raw);
}

function readIdentityUsernameFromRequest(cookieHeader?: string | null): string | null {
  const fromHelper = getCookie(IDENTITY_COOKIE);

  if (fromHelper != null && fromHelper.trim() !== "") {
    return fromHelper.trim();
  }

  return parseIdentityUsernameFromHeader(readRawCookieHeader(cookieHeader));
}

/** Store the Bearer token from a successful SSR refresh for reuse with the same cookie. */
export function rememberSsrAccessToken(accessToken: string, refreshToken?: string | null): void {
  const refresh = refreshToken ?? readRefreshTokenFromRequest(readRawCookieHeader());

  if (refresh == null || refresh.trim() === "") {
    return;
  }

  ssrAccessTokenByRefresh.set(refresh, {
    token: accessToken,
    expiresAt: Date.now() + SSR_TOKEN_TTL_MS,
  });
}

/** Read a Bearer token previously stored for this refresh cookie, if any. */
export function readSsrAccessToken(cookieHeader?: string | null): string | null {
  const refresh = readRefreshTokenFromRequest(cookieHeader ?? readRawCookieHeader());

  if (refresh == null || refresh.trim() === "") {
    return null;
  }

  const entry = ssrAccessTokenByRefresh.get(refresh);

  if (entry == null) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    ssrAccessTokenByRefresh.delete(refresh);

    return null;
  }

  return entry.token;
}

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

function forwardRefreshSetCookie(response: Response): void {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => Array<string>;
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
    email_verified: session.email_verified === true,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, BACKEND_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMeWithBearer(
  accessToken: string,
): Promise<{ ok: true; user: UserProfile } | { ok: false; status: number }> {
  const response = await fetchWithTimeout(getBackendAuthMeUrl(), {
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

async function refreshAccessTokenFromCookie(cookieHeader?: string | null): Promise<SessionPayload | null> {
  const refresh = readRefreshTokenFromRequest(cookieHeader);

  if (refresh == null || refresh.trim() === "") {
    return null;
  }

  const response = await fetchWithTimeout(getBackendRefreshUrl(), {
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
 * Falls back to a non-HttpOnly identity username cookie when the refresh
 * cookie is invisible so owner chrome can still paint on first HTML.
 */
export async function resolveAuthMe(cookieHeader?: string | null): Promise<UserProfile | null> {
  setResponseHeaders(
    new Headers({
      "Cache-Control": "private, no-store",
    }),
  );

  const resolvedHeader = cookieHeader ?? readRawCookieHeader() ?? null;
  const refresh = readRefreshTokenFromRequest(resolvedHeader);

  if (refresh != null && refresh.trim() !== "") {
    try {
      const session = await refreshAccessTokenFromCookie(resolvedHeader);

      if (session !== null) {
        rememberSsrAccessToken(session.access_token, refresh);
        const me = await fetchMeWithBearer(session.access_token);

        if (me.ok) {
          return me.user;
        }

        return toUserProfile(session);
      }
    } catch {
      // Refresh cookie was presented but rejected (revoked / expired /
      // malformed). Do not fall back to the identity hint — that cookie is
      // stale once the session is dead on the server.
      return null;
    }

    // Refresh cookie present but yielded no session body.
    return null;
  }

  const identityUsername = readIdentityUsernameFromRequest(resolvedHeader);

  if (identityUsername != null && identityUsername.length > 0) {
    return {
      id: "",
      username: identityUsername,
      email: "",
      display_name: null,
      is_active: true,
      email_verified: false,
      created_at: "",
      updated_at: "",
    };
  }

  return null;
}

export async function resolveRefreshAuthSession(cookieHeader?: string | null): Promise<UserProfile | null> {
  setResponseHeader("Cache-Control", "private, no-store");

  try {
    const session = await refreshAccessTokenFromCookie(cookieHeader ?? null);

    if (session === null) {
      return null;
    }

    return toUserProfile(session);
  } catch {
    return null;
  }
}

export async function resolveLogoutSession(cookieHeader?: string | null): Promise<null> {
  setResponseHeader("Cache-Control", "private, no-store");

  const refresh = readRefreshTokenFromRequest(cookieHeader ?? null);
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
}
