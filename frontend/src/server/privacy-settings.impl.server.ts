import { getCookie } from "@tanstack/react-start/server";

import { HttpStatus } from "@/libs/http-status";
import type { PrivacySettings } from "@/queries/privacy-settings";
import { readSsrAccessToken, rememberSsrAccessToken } from "@/server/auth.impl.server";

const REFRESH_TOKEN_COOKIE = "refresh_token";
const BACKEND_FETCH_TIMEOUT_MS = 5_000;

function getBackendOrigin(): string {
  const fromApiBase = process.env.VITE_API_BASE_URL?.trim();

  if (fromApiBase) {
    return fromApiBase.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  }

  return (process.env.VITE_BACKEND_ORIGIN?.trim() || "http://localhost:8000").replace(/\/$/, "");
}

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

type SessionPayload = {
  access_token: string;
};

async function resolveAccessToken(cookieHeader?: string | null): Promise<string | null> {
  const existing = readSsrAccessToken(cookieHeader);

  if (existing != null && existing.length > 0) {
    return existing;
  }

  let refresh = parseRefreshTokenFromCookieHeader(cookieHeader);

  if (refresh == null || refresh.trim() === "") {
    try {
      const fromCookie = getCookie(REFRESH_TOKEN_COOKIE);

      if (fromCookie != null && fromCookie.trim() !== "") {
        refresh = fromCookie;
      }
    } catch {
      // Outside a request context.
    }
  }

  if (refresh == null || refresh.trim() === "") {
    return null;
  }

  const response = await fetchWithTimeout(`${getBackendOrigin()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: `${REFRESH_TOKEN_COOKIE}=${refresh}`,
    },
  });

  if (response.status === HttpStatus.UNAUTHORIZED || !response.ok) {
    return null;
  }

  const body = (await response.json()) as SessionPayload;

  if (typeof body.access_token !== "string" || body.access_token.length === 0) {
    return null;
  }

  rememberSsrAccessToken(body.access_token, refresh);

  return body.access_token;
}

/**
 * Load privacy settings on the server using the refresh cookie (or a Bearer
 * token already obtained earlier in the same SSR request).
 */
export async function resolveMyPrivacySettings(cookieHeader?: string | null): Promise<PrivacySettings | null> {
  try {
    const accessToken = await resolveAccessToken(cookieHeader ?? null);

    if (accessToken == null) {
      return null;
    }

    const response = await fetchWithTimeout(`${getBackendOrigin()}/api/v1/users/me/privacy-settings`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === HttpStatus.UNAUTHORIZED || !response.ok) {
      return null;
    }

    return (await response.json()) as PrivacySettings;
  } catch {
    return null;
  }
}
