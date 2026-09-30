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

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
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
      is_active: body.is_active,
      email_verified: body.email_verified === true,
      created_at: body.created_at,
      updated_at: body.updated_at,
    },
    body.access_token,
  );
}

function toApiError(status: number, body: unknown): ApiError {
  const message =
    typeof body === "object" && body !== null && "detail" in body && body.detail != null
      ? String(body.detail)
      : `Request failed with status ${status}`;

  return new ApiError(message, status, body);
}

function axiosErrorToApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data ?? null;

  return toApiError(status, body);
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
      const { data } = await api.post<SessionPayload>("/auth/refresh", undefined, { skipAuthRefresh: true });

      if (!isSessionPayload(data)) {
        useAuthStore.getState().setAccessToken(null);

        return null;
      }

      applySessionFromBody(data);

      return data;
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
    const mayRefresh =
      status === HttpStatus.UNAUTHORIZED &&
      !skipRefresh &&
      !alreadyRetried &&
      shouldAttemptAuthRefresh(originalRequest.url);

    if (!mayRefresh) {
      return Promise.reject(axiosErrorToApiError(error));
    }

    originalRequest._retry = true;

    const session = await silentRefreshSession();

    if (session === null) {
      return Promise.reject(axiosErrorToApiError(error));
    }

    originalRequest.headers.set("Authorization", `Bearer ${session.access_token}`);

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
