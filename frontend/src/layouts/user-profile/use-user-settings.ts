import { useQuery } from "@tanstack/react-query";
import { getRouteApi, redirect } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";
import type { AuthRouterContext } from "@/libs/auth-session";
import type { UserProfile } from "@/libs/auth";
import { userActressSubscriptionsQueryOptions } from "@/queries/actress-subscribe";
import {
  publicUserProfileQueryOptions,
  userPlaylistsQueryOptions,
  userVideosQueryOptions,
} from "@/queries/user-profile";
import { myBlockedAccountsQueryOptions } from "@/queries/blocked-accounts";
import { useAuthStore } from "@/stores/auth-store";

const parentRouteApi = getRouteApi("/u/$username");

export function useUserSettingsContext(username: string) {
  const { user, isAuthenticated, isRestoring } = useAuth();
  const isOwner = isAuthenticated && user != null && user.username === username;

  const profileQuery = useQuery(publicUserProfileQueryOptions(username));

  return {
    username,
    user,
    isOwner,
    isRestoring,
    profile: profileQuery.data,
    profileQuery,
  };
}

/**
 * Resolve owner status with Zustand as the source of truth once restore
 * settles. Route context can lag after revoke-all / session-ended until
 * ``router.invalidate()`` finishes; trusting ``contextIsOwner`` alone keeps
 * owner chrome visible during client-side navigation.
 *
 * While restoring, allow context or a store hint so SSR→client upgrade does
 * not flash guest chrome. After restore, a null store is guest — but when
 * context still reports owner (invalidate in flight), keep ``isRestoring``
 * so owner pages show a skeleton instead of ``Navigate``-ing away and
 * getting stuck on the public profile until a hard refresh.
 */
export function useResolvedOwner(username: string): {
  isOwner: boolean;
  authUser: UserProfile | null;
  isRestoring: boolean;
} {
  const { isOwner: contextIsOwner, authUser } = parentRouteApi.useRouteContext();
  const storeUser = useAuthStore((state) => state.user);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  if (!isRestoring && storeUser == null) {
    if (contextIsOwner) {
      return { isOwner: false, authUser: null, isRestoring: true };
    }

    return { isOwner: false, authUser: null, isRestoring: false };
  }

  const resolvedUser = storeUser ?? authUser;
  const isOwner = (resolvedUser != null && resolvedUser.username === username) || (isRestoring && contextIsOwner);

  return { isOwner, authUser: resolvedUser, isRestoring };
}

/**
 * Shared ``beforeLoad`` guard for owner-only ``/u/$username/*`` sections.
 * Redirects confirmed non-owners (and settled guests) to the public profile.
 *
 * When the session user is authenticated but the URL handle does not match
 * (e.g. right after a username change), redirect to the same sub-path under
 * the current handle instead of the stale public profile (which 404s).
 *
 * SSR: when ``loadAuthSession`` already resolved guest (``user`` null),
 * redirect immediately so hard refresh after revoke-all does not hang on a
 * skeleton. When a username hint is present, allow paint and let the client
 * bootstrap confirm or clear the session.
 *
 * Client: while ``isRestoring``, wait; once settled, non-owners redirect.
 */
export function requireOwnerBeforeLoad({
  context,
  params,
  location,
}: {
  context: { auth: AuthRouterContext };
  params: { username: string };
  location: { pathname: string };
}): void {
  if (!context.auth.isReady) {
    return;
  }

  const routeUser = context.auth.user;

  if (routeUser != null && routeUser.username === params.username) {
    return;
  }

  if (typeof window !== "undefined") {
    const store = useAuthStore.getState();

    if (store.user != null && store.user.username === params.username) {
      return;
    }

    if (store.isRestoring) {
      return;
    }

    if (store.user != null) {
      const rest = location.pathname.replace(/^\/u\/[^/]+/, "") || "";

      throw redirect({
        href: `/u/${encodeURIComponent(store.user.username)}${rest}`,
        replace: true,
      });
    }

    throw redirect({
      to: "/u/$username",
      params: { username: params.username },
    });
  }

  if (routeUser == null || routeUser.username !== params.username) {
    throw redirect({
      to: "/u/$username",
      params: { username: params.username },
    });
  }
}

export function useOwnerVideos(username: string) {
  return useQuery(userVideosQueryOptions(username));
}

export function useOwnerPlaylists(username: string) {
  return useQuery(userPlaylistsQueryOptions(username));
}

export function useOwnerSubscriptions(username: string) {
  return useQuery(userActressSubscriptionsQueryOptions(username));
}

export function useOwnerBlocked(_username: string) {
  return useQuery(myBlockedAccountsQueryOptions());
}
