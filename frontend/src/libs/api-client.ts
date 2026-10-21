/**
 * HTTP client for the FastAPI backend (``/api/v1``).
 *
 * Browser: same-origin ``/api/v1`` (Vite proxy) so the HttpOnly refresh
 * cookie stays first-party. SSR: absolute ``VITE_API_BASE_URL`` when set.
 *
 * Access tokens live in the Zustand store and are attached as
 * ``Authorization: Bearer`` via a request interceptor. On 401, a response
 * interceptor runs a single-flight ``POST /auth/refresh`` and retries.
 */

import axios, { isAxiosError } from "axios";
import type { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

import { HttpStatus } from "@/libs/http-status";
import { getAccessToken, useAuthStore } from "@/stores/auth-store";

export const AUTH_SESSION_ENDED_EVENT = "velvet-auth-session-ended";

function dispatchSessionEndedEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_ENDED_EVENT));
}

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
  }
}

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
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, body: unknown, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type ApiSearchParams = Record<string, string | number | boolean | null | undefined | Array<string | number>>;

export type ApiFetchInit = {
  method?: AxiosRequestConfig["method"];
  data?: unknown;
  /** Alias for axios ``params`` (query string). */
  searchParams?: ApiSearchParams;
  headers?: AxiosRequestConfig["headers"];
  /** Skip the 401 → refresh → retry path (refresh/login/logout themselves). */
  skipAuthRefresh?: boolean;
};

export type SessionPayload = {
  access_token: string;
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  role?: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  skipAuthRefresh?: boolean;
  _retry?: boolean;
};

function shouldAttemptAuthRefresh(url: string | undefined): boolean {
  if (url == null || url === "") {
    return true;
  }

  const path = url.startsWith("http")
    ? new URL(url).pathname.replace(/^\/api\/v1/, "")
    : url.startsWith("/api/v1")
      ? url.slice("/api/v1".length)
      : url;
  const normalized = path.startsWith("/") ? path : `/${path}`;

  return (
    !normalized.startsWith("/auth/login") &&
    !normalized.startsWith("/auth/register") &&
    !normalized.startsWith("/auth/refresh") &&
    !normalized.startsWith("/auth/logout") &&
    !normalized.startsWith("/auth/change-password")
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
      role: body.role ?? "user",
      is_active: body.is_active,
      email_verified: body.email_verified === true,
      created_at: body.created_at,
      updated_at: body.updated_at,
    },
    body.access_token,
  );
}

function parseRetryAfterSeconds(value: string | number | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }

  const seconds = typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return seconds;
}

function toApiError(status: number, body: unknown, retryAfterSeconds: number | null = null): ApiError {
  const message =
    typeof body === "object" && body !== null && "detail" in body && body.detail != null
      ? String(body.detail)
      : `Request failed with status ${status}`;

  return new ApiError(message, status, body, retryAfterSeconds);
}

function axiosErrorToApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data ?? null;
  const headers = error.response?.headers;
  const retryRaw = headers == null ? undefined : (headers["retry-after"] ?? headers["Retry-After"]);
  const retryAfterSeconds = parseRetryAfterSeconds(
    typeof retryRaw === "string" || typeof retryRaw === "number" ? retryRaw : undefined,
  );

  return toApiError(status, body, retryAfterSeconds);
}

const api: AxiosInstance = axios.create({
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
  // Match previous URLSearchParams behavior: repeated keys, no brackets.
  paramsSerializer: {
    indexes: null,
  },
  validateStatus: (status) => status >= 200 && status < 300,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.baseURL = getApiBaseUrl();

    const token = getAccessToken();

    if (token != null && token.length > 0) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
  { synchronous: true },
);

/**
 * Silent refresh result.
 *
 * - ``session``: rotated access token + profile
 * - ``unauthorized``: cookie missing/invalid (true logout)
 * - ``transient``: network / timeout — keep any SSR-seeded profile
 */
export type SilentRefreshResult =
  { status: "ok"; session: SessionPayload } | { status: "unauthorized" } | { status: "transient" };

/** Allow slow responses while large uploads saturate the connection pool. */
const SILENT_REFRESH_TIMEOUT_MS = 30_000;

let refreshInFlightResult: Promise<SilentRefreshResult> | null = null;

function isRequestAborted(error: unknown): boolean {
  if (isAxiosError(error)) {
    if (error.code === "ERR_CANCELED" || error.code === "ECONNABORTED") {
      return true;
    }

    const message = String(error.message).toLowerCase();

    return message.includes("abort") || message.includes("canceled") || message.includes("cancelled");
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return false;
}

/**
 * Silent refresh: exchange the HttpOnly refresh cookie for a new access token.
 *
 * Single-flight so boot, 401 interceptors, and focus refetch share one call.
 */
export async function silentRefreshSession(): Promise<SessionPayload | null> {
  const result = await silentRefreshSessionDetailed();

  return result.status === "ok" ? result.session : null;
}

export async function silentRefreshSessionDetailed(): Promise<SilentRefreshResult> {
  if (typeof window === "undefined") {
    return { status: "unauthorized" };
  }

  if (refreshInFlightResult !== null) {
    return refreshInFlightResult;
  }

  refreshInFlightResult = (async (): Promise<SilentRefreshResult> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
    }, SILENT_REFRESH_TIMEOUT_MS);

    try {
      const { data } = await api.post<SessionPayload>("/auth/refresh", undefined, {
        skipAuthRefresh: true,
        signal: controller.signal,
        timeout: SILENT_REFRESH_TIMEOUT_MS,
      });

      if (!isSessionPayload(data)) {
        useAuthStore.getState().clearUser();

        return { status: "unauthorized" };
      }

      applySessionFromBody(data);

      return { status: "ok", session: data };
    } catch (error: unknown) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const isAuthFailure = status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN;

      if (isAuthFailure) {
        useAuthStore.getState().clearUser();
        dispatchSessionEndedEvent();

        return { status: "unauthorized" };
      }

      // Aborts / timeouts / network blips must not wipe a still-valid access
      // token — that forces another refresh during long multipart uploads and
      // produces cascading NS_BINDING_ABORTED refresh rows in the network panel.
      const existing = getAccessToken();
      const exp = getAccessTokenExpiryUnix(existing);
      const nowUnix = Math.floor(Date.now() / 1000);
      const stillValid = existing != null && exp != null && exp - nowUnix > 15;

      if (!stillValid && !isRequestAborted(error)) {
        useAuthStore.getState().setAccessToken(null);
      }

      return { status: "transient" };
    } finally {
      window.clearTimeout(timer);
      refreshInFlightResult = null;
    }
  })();

  return refreshInFlightResult;
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

/**
 * Read ``exp`` from a JWT access token without verifying the signature.
 * Returns unix seconds, or null when the token is missing/malformed.
 */
export function getAccessTokenExpiryUnix(token: string | null | undefined): number | null {
  if (token == null || token.length === 0) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json) as { exp?: unknown };

    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

/**
 * Ensure the in-memory access token has at least ``minTtlSeconds`` left.
 *
 * Only calls ``/auth/refresh`` (which rotates the refresh cookie) when the
 * current access token is missing or about to expire. Prefer this over
 * blind periodic refresh during long operations such as multi-GB uploads.
 */
export async function ensureFreshAccessToken(minTtlSeconds = 90): Promise<string | null> {
  const existing = getAccessToken();
  const exp = getAccessTokenExpiryUnix(existing);
  const nowUnix = Math.floor(Date.now() / 1000);

  if (existing != null && existing.length > 0 && exp != null && exp - nowUnix > minTtlSeconds) {
    return existing;
  }

  const result = await silentRefreshSessionDetailed();

  if (result.status === "ok") {
    return result.session.access_token;
  }

  // Transient abort/timeout: keep using the current access token if it is
  // still unexpired. Only fail hard when the token is gone or already expired.
  if (result.status === "transient") {
    const current = getAccessToken();
    const currentExp = getAccessTokenExpiryUnix(current);

    if (current != null && currentExp != null && currentExp - Math.floor(Date.now() / 1000) > 0) {
      return current;
    }
  }

  return null;
}

api.interceptors.response.use(
  (response) => {
    if (isSessionPayload(response.data)) {
      applySessionFromBody(response.data);
    }

    return response;
  },
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response == null) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (originalRequest == null) {
      return Promise.reject(axiosErrorToApiError(error));
    }

    const status = error.response.status;
    const skipRefresh = originalRequest.skipAuthRefresh === true;
    const alreadyRetried = originalRequest._retry === true;
    const isAuthStatus = status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN;
    const mayRefresh =
      status === HttpStatus.UNAUTHORIZED &&
      !skipRefresh &&
      !alreadyRetried &&
      shouldAttemptAuthRefresh(originalRequest.url);

    if (!mayRefresh) {
      if (isAuthStatus && !skipRefresh && useAuthStore.getState().user != null) {
        useAuthStore.getState().clearUser();
        dispatchSessionEndedEvent();
      }

      return Promise.reject(axiosErrorToApiError(error));
    }

    originalRequest._retry = true;

    const refresh = await silentRefreshSessionDetailed();

    if (refresh.status !== "ok") {
      if (refresh.status === "unauthorized" || useAuthStore.getState().user != null) {
        useAuthStore.getState().clearUser();
        dispatchSessionEndedEvent();
      }

      return Promise.reject(axiosErrorToApiError(error));
    }

    originalRequest.headers.set("Authorization", `Bearer ${refresh.session.access_token}`);

    return api.request(originalRequest);
  },
);

/**
 * Typed API helper used across the app. Prefer this over calling axios
 * directly so interceptors and error mapping stay consistent.
 */
export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const method = (init?.method ?? "GET").toString().toLowerCase();

  try {
    const response = await api.request<T>({
      url: normalized,
      method,
      data: init?.data,
      params: init?.searchParams,
      headers: init?.headers,
      skipAuthRefresh: init?.skipAuthRefresh,
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (isAxiosError(error)) {
      throw axiosErrorToApiError(error);
    }

    throw error;
  }
}

export { api as axiosApi };
