/**
 * HTTP client for the FastAPI backend (``/api/v1``).
 *
 * In the browser always use same-origin ``/api/v1`` so the Vite proxy
 * forwards to the backend and the HttpOnly refresh cookie stays first-party.
 * Absolute ``VITE_API_BASE_URL`` is only for SSR.
 *
 * Access tokens are read from the in-memory Zustand store and sent as
 * ``Authorization: Bearer``. On hard refresh the access token is gone; a
 * silent ``POST /auth/refresh`` (cookie Path ``/api/v1/auth/``) restores it.
 * Concurrent 401s share one in-flight refresh (single-flight).
 */

import { HttpStatus } from "@/libs/http-status";
import { getAccessToken, useAuthStore } from "@/stores/auth-store";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/v1";
  }

  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (fromEnv && fromEnv.trim() !== "") {
    return fromEnv.replace(/\/$/, "");
  }

  return "http://localhost:8000/api/v1";
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type ApiSearchParams = Record<string, string | number | boolean | null | undefined | Array<string | number>>;

export type ApiFetchInit = RequestInit & {
  searchParams?: ApiSearchParams;
  /** Skip the 401 → refresh → retry path (used by the refresh call itself). */
  skipAuthRefresh?: boolean;
};

export type SessionPayload = {
  access_token: string;
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function appendSearchParams(url: URL, params?: ApiSearchParams): void {
  if (!params) {
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }

      continue;
    }

    url.searchParams.set(key, String(value));
  }
}

function buildRequestUrl(path: string, searchParams?: ApiSearchParams): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl().replace(/\/$/, "");
  const absoluteBase =
    base.startsWith("http://") || base.startsWith("https://")
      ? base
      : `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}${base.startsWith("/") ? base : `/${base}`}`;
  const url = new URL(`${absoluteBase}${normalized}`);

  appendSearchParams(url, searchParams);

  return url;
}

function shouldAttemptAuthRefresh(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  return (
    !normalized.startsWith("/auth/login") &&
    !normalized.startsWith("/auth/register") &&
    !normalized.startsWith("/auth/refresh") &&
    !normalized.startsWith("/auth/logout")
  );
}

export function isSessionPayload(body: unknown): body is SessionPayload {
  return (
    typeof body === "object" &&
    body !== null &&
    "access_token" in body &&
    typeof body.access_token === "string" &&
    (body as { access_token: string }).access_token.length > 0 &&
    "id" in body &&
    typeof (body as { id: unknown }).id === "string"
  );
}

/**
 * Persist access token (and profile when present) from a session response.
 */
export function applySessionFromBody(body: unknown): void {
  if (!isSessionPayload(body)) {
    return;
  }

  useAuthStore.getState().setSession(
    {
      id: body.id,
      username: body.username,
      email: body.email,
      display_name: body.display_name,
      is_active: body.is_active,
      created_at: body.created_at,
      updated_at: body.updated_at,
    },
    body.access_token,
  );
}

let refreshInFlight: Promise<SessionPayload | null> | null = null;

/**
 * Silent refresh: exchange the HttpOnly refresh cookie for a new access token.
 *
 * Single-flight so boot, 401 interceptors, and focus refetch share one call.
 * Returns the session payload or ``null`` when the cookie is missing/invalid.
 */
export async function silentRefreshSession(): Promise<SessionPayload | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (refreshInFlight !== null) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const body = await apiFetchRaw<SessionPayload>("/auth/refresh", {
        method: "POST",
      });

      if (!isSessionPayload(body)) {
        useAuthStore.getState().setAccessToken(null);

        return null;
      }

      applySessionFromBody(body);

      return body;
    } catch {
      useAuthStore.getState().setAccessToken(null);

      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Return a usable access token, silently refreshing when memory is empty.
 *
 * Call this on hard reload / boot before protected API requests.
 */
export async function ensureAccessToken(): Promise<string | null> {
  const existing = getAccessToken();

  if (existing != null && existing.length > 0) {
    return existing;
  }

  const session = await silentRefreshSession();

  if (session === null) {
    return null;
  }

  return session.access_token;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const message =
    typeof body === "object" && body !== null && "detail" in body && body.detail != null
      ? String(body.detail)
      : `Request failed with status ${status}`;

  return new ApiError(message, status, body);
}

/**
 * Low-level fetch without the 401 → refresh loop (used by silent refresh).
 */
async function apiFetchRaw<T>(path: string, init?: RequestInit & { searchParams?: ApiSearchParams }): Promise<T> {
  const { searchParams, ...requestInit } = init ?? {};
  const url = buildRequestUrl(path, searchParams);
  const accessToken = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(requestInit.headers as Record<string, string> | undefined),
  };

  if (accessToken != null && accessToken.length > 0) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...requestInit,
    credentials: "include",
    headers,
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  return body as T;
}

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { searchParams, skipAuthRefresh, ...requestInit } = init ?? {};
  const url = buildRequestUrl(path, searchParams);
  const accessToken = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(requestInit.headers as Record<string, string> | undefined),
  };

  if (accessToken != null && accessToken.length > 0) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...requestInit,
    credentials: "include",
    headers,
  });

  const body = await parseResponseBody(response);

  if (response.status === HttpStatus.UNAUTHORIZED && skipAuthRefresh !== true && shouldAttemptAuthRefresh(path)) {
    const session = await silentRefreshSession();

    if (session !== null) {
      return apiFetch<T>(path, {
        ...init,
        skipAuthRefresh: true,
      });
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  if (isSessionPayload(body)) {
    applySessionFromBody(body);
  }

  return body as T;
}
