/**
 * HTTP client for the FastAPI backend (``/api/v1``).
 *
 * In the browser always use same-origin ``/api/v1`` so the Vite proxy
 * forwards to the backend and the HttpOnly ``access_token`` cookie stays
 * first-party. Absolute ``VITE_API_BASE_URL`` is only for SSR.
 */

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

export async function apiFetch<T>(path: string, init?: RequestInit & { searchParams?: ApiSearchParams }): Promise<T> {
  const { searchParams, ...requestInit } = init ?? {};
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl().replace(/\/$/, "");
  const absoluteBase =
    base.startsWith("http://") || base.startsWith("https://")
      ? base
      : `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}${base.startsWith("/") ? base : `/${base}`}`;
  const url = new URL(`${absoluteBase}${normalized}`);

  appendSearchParams(url, searchParams);

  const response = await fetch(url, {
    ...requestInit,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(requestInit.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "detail" in body && body.detail != null
        ? String(body.detail)
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, body);
  }

  return body as T;
}
