/**
 * Neutral placeholder while the session cookie is being validated.
 * Avoids flashing guest or account UI before redirects run.
 */
export function AuthPendingShell() {
  return <div className="min-h-screen bg-background" aria-busy="true" aria-label="Checking session" />;
}
