/**
 * Non-HttpOnly identity hint cookie.
 *
 * Carries only the public username so hard-reload first paint (and SSR when
 * the refresh cookie is invisible to Start) can show owner chrome without
 * waiting for silent refresh. Never stores tokens or email.
 */

const IDENTITY_COOKIE = "velvet_uid";
const IDENTITY_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function readIdentityUsername(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = document.cookie;

  if (raw == null || raw.trim() === "") {
    return null;
  }

  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf("=");

    if (eq <= 0) {
      continue;
    }

    const name = part.slice(0, eq).trim();

    if (name !== IDENTITY_COOKIE) {
      continue;
    }

    const value = decodeURIComponent(part.slice(eq + 1).trim());

    return value.length > 0 ? value : null;
  }

  return null;
}

export function writeIdentityUsername(username: string): void {
  if (!isBrowser()) {
    return;
  }

  const safe = encodeURIComponent(username.trim());

  if (safe.length === 0) {
    clearIdentityUsername();

    return;
  }

  document.cookie = [
    `${IDENTITY_COOKIE}=${safe}`,
    "Path=/",
    `Max-Age=${IDENTITY_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ].join("; ");
}

export function clearIdentityUsername(): void {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${IDENTITY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Parse identity username from a raw Cookie header (SSR). */
export function parseIdentityUsernameFromHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (cookieHeader == null || cookieHeader.trim() === "") {
    return null;
  }

  for (const part of cookieHeader.split(/;\s*/)) {
    const eq = part.indexOf("=");

    if (eq <= 0) {
      continue;
    }

    const name = part.slice(0, eq).trim();

    if (name !== IDENTITY_COOKIE) {
      continue;
    }

    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim());

      return value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }

  return null;
}

export { IDENTITY_COOKIE };
