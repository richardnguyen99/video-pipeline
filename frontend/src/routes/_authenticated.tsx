import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AuthPendingShell } from "@/components/auth/auth-pending-shell";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Pathless layout: all child routes require a signed-in user.
 *
 * Redirects are handled only in ``beforeLoad`` (TanStack auth pattern).
 * The layout never calls ``navigate`` — that caused maximum update depth
 * loops when paired with ``router.invalidate()`` after silent refresh.
 *
 * While the silent-auth interceptor is still running, show a pending shell.
 * On SSR, root ``beforeLoad`` already resolved the session via the refresh
 * cookie — render children immediately so studio chrome (sidebar) is in the
 * first HTML payload.
 *
 * @see https://tanstack.com/router/latest/docs/guide/authenticated-routes
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (typeof window === "undefined") {
      return;
    }

    if (!context.auth.isReady) {
      return;
    }

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
  const routeAuth = Route.useRouteContext({
    select: (ctx) => ctx.auth,
  });
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const user = useAuthStore((state) => state.user);

  if (typeof window === "undefined") {
    if (routeAuth.isAuthenticated && routeAuth.user != null) {
      return <Outlet />;
    }

    return <AuthPendingShell />;
  }

  if (isRestoring || user === null) {
    return <AuthPendingShell />;
  }

  return <Outlet />;
}
