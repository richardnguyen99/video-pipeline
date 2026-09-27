/**
 * HTTP client for the FastAPI backend (``/api/v1``).
 *
 * In the browser always use same-origin ``/api/v1`` so the Vite proxy
 * forwards to the backend and the HttpOnly auth cookies stay first-party.
 * Absolute ``VITE_API_BASE_URL`` is only for SSR.
 *
 * On ``401``, one silent ``POST /auth/refresh`` is attempted (single-flight)
 * before failing, so short-lived access tokens do not force a re-login while
 * a valid refresh cookie remains.
 */

import { HttpStatus } from "@/libs/http-status";

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

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Single-flight refresh so concurrent 401s share one refresh request.
 */
async function refreshAccessTokenOnce(): Promise<boolean> {
  if (refreshInFlight !== null) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      await apiFetch("/auth/refresh", {
        method: "POST",
        skipAuthRefresh: true,
      });

      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
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

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { searchParams, skipAuthRefresh, ...requestInit } = init ?? {};
  const url = buildRequestUrl(path, searchParams);

  const response = await fetch(url, {
    ...requestInit,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(requestInit.headers ?? {}),
    },
  });

  const body = await parseResponseBody(response);

  if (response.status === HttpStatus.UNAUTHORIZED && skipAuthRefresh !== true && shouldAttemptAuthRefresh(path)) {
    const refreshed = await refreshAccessTokenOnce();

    if (refreshed) {
      return apiFetch<T>(path, {
        ...init,
        skipAuthRefresh: true,
      });
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  return body as T;
}
