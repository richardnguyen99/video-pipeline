import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AuthPendingShell } from "@/components/auth/auth-pending-shell";

/**
 * Pathless layout: all child routes are for signed-out users only.
 * @see https://tanstack.com/router/latest/docs/how-to/setup-authentication
 */
export const Route = createFileRoute("/_guest")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  pendingComponent: AuthPendingShell,
  component: GuestLayout,
});

function GuestLayout() {
  return <Outlet />;
}
