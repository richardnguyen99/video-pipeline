/**
 * Placeholder auth state until real auth is wired.
 * Defaults to unauthenticated so guest-only UI can be developed.
 */
export function useAuth() {
  return {
    isAuthenticated: false as boolean,
    user: null as { id: string; username: string } | null,
  };
}
