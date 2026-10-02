import { Suspense } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { SettingsContentSkeleton, SettingsShell } from "@/layouts/user-profile/settings-shell";
import { useUserSettingsContext } from "@/layouts/user-profile/use-user-settings";
import type { SettingsNavKey } from "@/layouts/user-profile/settings-nav";

function pathToSettingsNavKey(pathname: string): SettingsNavKey {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "profile";

  return segment as SettingsNavKey;
}

export const Route = createFileRoute("/u/$username")({
  component: UserProfileLayout,
});

function UserProfileLayout() {
  const { username } = Route.useParams();
  const { isOwner } = useUserSettingsContext(username);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const active = pathToSettingsNavKey(pathname);

  return (
    <SettingsShell username={username} active={active} isOwner={isOwner}>
      <Suspense fallback={<SettingsContentSkeleton />}>
        <Outlet />
      </Suspense>
    </SettingsShell>
  );
}
