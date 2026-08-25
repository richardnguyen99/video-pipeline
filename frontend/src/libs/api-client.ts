/**
 * HTTP client for the FastAPI backend (`/api/v1`).
 */

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (fromEnv && fromEnv.trim() !== "") {
    return fromEnv.replace(/\/$/, "");
  }

  return "http://127.0.0.1:8000/api/v1";
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
  const url = new URL(`${getApiBaseUrl()}${normalized}`);

  appendSearchParams(url, searchParams);

  const response = await fetch(url, {
    ...requestInit,
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
