/**
 * Auth API helpers (registration, login, session refresh).
 */

import { ApiError, apiFetch, applySessionFromBody, isSessionPayload, silentRefreshSession } from "@/libs/api-client";
import type { SessionPayload } from "@/libs/api-client";
import { resetAuthBootstrap } from "@/libs/auth-bootstrap";
import { logoutSession } from "@/server/auth.functions";
import { useAuthStore } from "@/stores/auth-store";

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  display_name?: string | null;
};

export type LoginPayload = {
  email: string;
  password: string;
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

function toUserProfile(session: SessionPayload): UserProfile {
  return {
    id: session.id,
    username: session.username,
    email: session.email,
    display_name: session.display_name,
    is_active: session.is_active,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

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
    data: body,
    skipAuthRefresh: true,
  });
}

export async function loginUser(payload: LoginPayload): Promise<UserProfile> {
  const session = await apiFetch<SessionPayload>("/auth/login", {
    method: "POST",
    data: {
      email: payload.email.trim(),
      password: payload.password,
    },
    skipAuthRefresh: true,
  });

  const user = toUserProfile(session);
  const { markAuthBootstrapSession } = await import("@/libs/auth-bootstrap");

  markAuthBootstrapSession(user, session.access_token);

  return user;
}

export async function logoutUser(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", {
      method: "POST",
      skipAuthRefresh: true,
    });
  } catch {
    // Fall through to clear client state.
  }

  try {
    await logoutSession();
  } catch {
    // Server function is best-effort when the refresh cookie path is scoped.
  }

  resetAuthBootstrap();
  useAuthStore.getState().clearUser();
}

/**
 * Silent refresh from the HttpOnly refresh cookie into memory.
 * Prefer this after hard reload or when the access token is missing.
 */
export async function refreshUserSession(): Promise<UserProfile | null> {
  const session = await silentRefreshSession();

  if (session === null || !isSessionPayload(session)) {
    return null;
  }

  applySessionFromBody(session);

  return toUserProfile(session);
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/auth/me", {
    method: "GET",
  });
}

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

/**
 * Change the signed-in user's password.
 *
 * On success the backend revokes all refresh sessions and clears the
 * refresh cookie. The caller must wipe the in-memory access token and
 * send the user back to sign-in.
 */
export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiFetch<void>("/auth/change-password", {
    method: "POST",
    data: {
      current_password: payload.current_password,
      new_password: payload.new_password,
    },
    skipAuthRefresh: true,
  });

  resetAuthBootstrap();
  useAuthStore.getState().clearUser();
}
