import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, getRequestHeader } from "@tanstack/react-start/server";

import { HttpStatus } from "@/libs/http-status";
import type { ActressSubscribeStatusApi } from "@/queries/actress-subscribe";
import {
  readSsrAccessToken,
  rememberSsrAccessToken,
} from "@/server/auth.functions";

const REFRESH_TOKEN_COOKIE = "refresh_token";
const BACKEND_FETCH_TIMEOUT_MS = 5_000;

function getBackendOrigin(): string {
  const fromApiBase = process.env.VITE_API_BASE_URL?.trim();

  if (fromApiBase) {
    return fromApiBase.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  }

  return (process.env.VITE_BACKEND_ORIGIN?.trim() || "http://localhost:8000").replace(
    /\/$/,
    "",
  );
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
    // Outside a request context.
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

  return parseRefreshTokenFromCookieHeader(readRawCookieHeader(cookieHeader));
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

/**
 * Prefer the access token already obtained by ``fetchAuthMe`` in this request
 * so we do not burn a rotated refresh token. Fall back to a single refresh
 * when that token is unavailable (e.g. client-side server-fn call).
 */
async function resolveAccessToken(cookieHeader?: string | null): Promise<string | null> {
  const existing = readSsrAccessToken();

  if (existing != null && existing.length > 0) {
    return existing;
  }

  const refresh = readRefreshTokenFromRequest(cookieHeader);

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

  rememberSsrAccessToken(body.access_token);

  return body.access_token;
}

const forwardRequestCookieMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, request }) => {
    const cookieHeader = request.headers.get("cookie");

    return next({
      context: {
        cookieHeader: cookieHeader ?? null,
      },
    });
  },
);

/**
 * Resolve actress subscription status on the server using the refresh cookie
 * (or a Bearer token already obtained earlier in the same SSR request).
 * Seeds the dehydrated query cache so the subscribe button does not flash.
 */
export const fetchActressSubscribeStatusServer = createServerFn({ method: "POST" })
  .middleware([forwardRequestCookieMiddleware])
  .handler(async ({ context, data }): Promise<ActressSubscribeStatusApi | null> => {
    const actressId = Number((data as { actressId?: number } | null)?.actressId);

    if (!Number.isFinite(actressId) || actressId < 1) {
      return null;
    }

    try {
      const accessToken = await resolveAccessToken(context.cookieHeader ?? null);

      if (accessToken == null) {
        return null;
      }

      const response = await fetchWithTimeout(
        `${getBackendOrigin()}/api/v1/actresses/${actressId}/subscribe`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.status === HttpStatus.UNAUTHORIZED || !response.ok) {
        return null;
      }

      return (await response.json()) as ActressSubscribeStatusApi;
    } catch {
      return null;
    }
  });
