import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import type { SettingsNavKey } from "@/layouts/user-profile/settings-nav";
import { SettingsShell } from "@/layouts/user-profile/settings-shell";
import type { UserProfile } from "@/libs/auth";
import { useAuthStore } from "@/stores/auth-store";

type UserProfileRouteContext = {
  isOwner: boolean;
  isAuthReady: boolean;
  authUser: UserProfile | null;
};

function pathToSettingsNavKey(pathname: string, username: string): SettingsNavKey {
  const parts = pathname.split("/").filter(Boolean);
  const sub = parts.length >= 3 ? parts[2] : undefined;

  if (sub == null || sub === username) {
    return "profile";
  }

  switch (sub) {
    case "videos":
      return "videos";
    case "subscriptions":
      return "subscriptions";
    case "security":
      return "security";
    case "content-preference":
      return "content-preference";
    case "notifications":
      return "notifications";
    case "privacy":
      return "privacy";
    case "blocked-accounts":
      return "blocked-accounts";
    case "deactivate":
      return "deactivate";
    default:
      return "profile";
  }
}

export const Route = createFileRoute("/u/$username")({
  beforeLoad: ({ context, params }): UserProfileRouteContext => {
    const auth = context.auth;
    const isAuthReady = auth.isReady;
    const authUser = auth.user;
    const isOwner = isAuthReady && auth.isAuthenticated && authUser != null && authUser.username === params.username;

    return {
      isOwner,
      isAuthReady,
      authUser,
    };
  },
  component: UserProfileLayout,
});

function UserProfileLayout() {
  const { username } = Route.useParams();
  const { isOwner: contextIsOwner, authUser } = Route.useRouteContext();
  const storeUser = useAuthStore((state) => state.user);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const active = pathToSettingsNavKey(pathname, username);

  const resolvedUser = authUser ?? storeUser;
  const isOwner = contextIsOwner || (resolvedUser != null && resolvedUser.username === username);

  return (
    <SettingsShell username={username} active={active} isOwner={isOwner}>
      <Outlet />
    </SettingsShell>
  );
}
