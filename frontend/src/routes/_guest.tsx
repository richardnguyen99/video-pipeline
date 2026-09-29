import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AuthPendingShell } from "@/components/auth/auth-pending-shell";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Pathless layout: signed-out users only.
 *
 * Redirects are handled only in ``beforeLoad``. No client ``navigate`` in
 * effects — that raced with ``router.invalidate()`` and caused update loops.
 *
 * @see https://tanstack.com/router/latest/docs/how-to/setup-authentication
 */
export const Route = createFileRoute("/_guest")({
  beforeLoad: ({ context }) => {
    if (typeof window === "undefined") {
      return;
    }

    if (!context.auth.isReady) {
      return;
    }

    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  pendingComponent: AuthPendingShell,
  component: GuestLayout,
});

function GuestLayout() {
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const user = useAuthStore((state) => state.user);

  if (isRestoring || user !== null) {
    return <AuthPendingShell />;
  }

  return <Outlet />;
}
