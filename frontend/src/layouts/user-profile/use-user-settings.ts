import { useQuery } from "@tanstack/react-query";
import { getRouteApi, redirect } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";
import type { AuthRouterContext } from "@/libs/auth-session";
import type { UserProfile } from "@/libs/auth";
import {
  publicUserProfileQueryOptions,
  userBlockedAccountsQueryOptions,
  userFollowedCreatorsQueryOptions,
  userPlaylistsQueryOptions,
  userVideosQueryOptions,
} from "@/queries/user-profile";
import { useAuthStore } from "@/stores/auth-store";

const parentRouteApi = getRouteApi("/u/$username");

export function useUserSettingsContext(username: string) {
  const { user, isAuthenticated, isRestoring } = useAuth();
  const isOwner =
    isAuthenticated && user != null && user.username === username;

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
 * Resolve owner status from route context first, then Zustand.
 * Child routes must use this so a guest SSR payload that is upgraded by
 * AuthStoreSync still shows owner chrome without waiting for invalidate.
 */
export function useResolvedOwner(username: string): {
  isOwner: boolean;
  authUser: UserProfile | null;
} {
  const { isOwner: contextIsOwner, authUser } = parentRouteApi.useRouteContext();
  const storeUser = useAuthStore((state) => state.user);
  const resolvedUser = authUser ?? storeUser;
  const isOwner =
    contextIsOwner ||
    (resolvedUser != null && resolvedUser.username === username);

  return { isOwner, authUser: resolvedUser };
}

/**
 * Shared ``beforeLoad`` guard for owner-only ``/u/$username/*`` sections.
 * Redirects confirmed non-owners to the public profile index.
 *
 * On SSR, when auth is still unknown (refresh cookie invisible), do not
 * redirect — the client identity cookie / bootstrap will allow or deny.
 * Only redirect when we know the viewer is a different authenticated user
 * or a settled guest on the client.
 */
export function requireOwnerBeforeLoad({
  context,
  params,
}: {
  context: { auth: AuthRouterContext };
  params: { username: string };
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

    throw redirect({
      to: "/u/$username",
      params: { username: params.username },
    });
  }

  if (routeUser != null && routeUser.username !== params.username) {
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

export function useOwnerFollowed(username: string) {
  return useQuery(userFollowedCreatorsQueryOptions(username));
}

export function useOwnerBlocked(username: string) {
  return useQuery(userBlockedAccountsQueryOptions(username));
}
