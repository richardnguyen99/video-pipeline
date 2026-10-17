import { createFileRoute, Navigate } from "@tanstack/react-router";

import { BlockedAccountsPanel } from "@/layouts/user-profile/blocked-accounts-panel";
import { SettingsContentSkeleton } from "@/layouts/user-profile/settings-shell";
import { requireOwnerBeforeLoad, useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { blockedAccountsQueryKeys, myBlockedAccountsQueryOptions } from "@/queries/blocked-accounts";
import type { BlockedAccountListResponse } from "@/queries/blocked-accounts";
import { fetchMyBlockedAccountsServer } from "@/server/blocked-accounts.functions";

export const Route = createFileRoute("/u/$username/blocked-accounts")({
  beforeLoad: requireOwnerBeforeLoad,
  loader: async ({ context }) => {
    const cached = context.queryClient.getQueryData<BlockedAccountListResponse>(blockedAccountsQueryKeys.me());

    if (cached != null) {
      return { blocked: cached };
    }

    if (typeof window === "undefined") {
      const blocked = await fetchMyBlockedAccountsServer();

      if (blocked != null) {
        context.queryClient.setQueryData(blockedAccountsQueryKeys.me(), blocked);
      }

      return { blocked };
    }

    if (!context.auth.isReady || context.auth.user == null) {
      return { blocked: null as BlockedAccountListResponse | null };
    }

    try {
      const blocked = await context.queryClient.query({
        ...myBlockedAccountsQueryOptions(),
        staleTime: "static",
      });

      return { blocked };
    } catch {
      return { blocked: null as BlockedAccountListResponse | null };
    }
  },
  component: BlockedAccountsPage,
});

function BlockedAccountsPage() {
  const { username } = Route.useParams();
  const { blocked } = Route.useLoaderData();
  const { isOwner, authUser, isRestoring } = useResolvedOwner(username);

  if (!isRestoring && authUser != null && authUser.username !== username) {
    return <Navigate to="/u/$username/blocked-accounts" params={{ username: authUser.username }} replace />;
  }

  if (!isRestoring && !isOwner) {
    return <Navigate to="/u/$username" params={{ username }} />;
  }

  if (isRestoring && !isOwner) {
    return <SettingsContentSkeleton />;
  }

  return <BlockedAccountsPanel initialBlocked={blocked} />;
}
