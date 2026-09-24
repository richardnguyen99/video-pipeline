import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AuthPendingShell } from "@/components/auth/auth-pending-shell";

/**
 * Pathless layout: all child routes require a signed-in user.
 * @see https://tanstack.com/router/latest/docs/guide/authenticated-routes
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  pendingComponent: AuthPendingShell,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Outlet />;
}
