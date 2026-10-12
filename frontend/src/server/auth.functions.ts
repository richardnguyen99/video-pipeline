import { createServerFn } from "@tanstack/react-start";

import type { UserProfile } from "@/libs/auth";

/**
 * Resolve the current user on the server via refresh cookie → Bearer me.
 * Falls back to a non-HttpOnly identity username cookie when the refresh
 * cookie is invisible so owner chrome can still paint on first HTML.
 *
 * Cookie reading lives in ``auth.impl.server`` (``getRequest`` / ``getCookie``)
 * so this module stays free of ``@tanstack/react-start/server`` imports.
 */
export const fetchAuthMe = createServerFn({ method: "GET" }).handler(async (): Promise<UserProfile | null> => {
  const { resolveAuthMe } = await import("./auth.impl.server");

  return resolveAuthMe();
});

/**
 * Explicitly refresh; returns profile when successful.
 */
export const refreshAuthSession = createServerFn({ method: "POST" }).handler(async (): Promise<UserProfile | null> => {
  const { resolveRefreshAuthSession } = await import("./auth.impl.server");

  return resolveRefreshAuthSession();
});

/**
 * End the session: revoke on the API and clear cookies on this response.
 */
export const logoutSession = createServerFn({ method: "POST" }).handler(async (): Promise<null> => {
  const { resolveLogoutSession } = await import("./auth.impl.server");

  return resolveLogoutSession();
});
