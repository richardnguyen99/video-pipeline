/**
 * Auth API helpers (registration and future session flows).
 */

import { ApiError, apiFetch } from "@/libs/api-client";

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  display_name?: string | null;
};

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body;

    if (typeof body === "object" && body !== null) {
      const record = body as Record<string, unknown>;

      if (typeof record.error === "object" && record.error !== null && "detail" in record.error) {
        const detail = record.error.detail;

        if (typeof detail === "string") {
          return detail;
        }

        if (Array.isArray(detail)) {
          return detail
            .map((item) => {
              if (typeof item === "object" && item !== null && "msg" in item) {
                return String((item as { msg: unknown }).msg);
              }

              return String(item);
            })
            .filter(Boolean)
            .join(" ");
        }
      }

      if (typeof record.detail === "string") {
        return record.detail;
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export async function registerUser(payload: RegisterPayload): Promise<UserProfile> {
  const body: RegisterPayload = {
    username: payload.username.trim(),
    email: payload.email.trim(),
    password: payload.password,
  };

  const displayName = payload.display_name?.trim();

  if (displayName) {
    body.display_name = displayName;
  }

  return apiFetch<UserProfile>("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
