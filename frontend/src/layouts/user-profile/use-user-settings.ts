import { useQuery } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";
import {
  publicUserProfileQueryOptions,
  userBlockedAccountsQueryOptions,
  userFollowedCreatorsQueryOptions,
  userPlaylistsQueryOptions,
  userVideosQueryOptions,
} from "@/queries/user-profile";

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

export function assertOwnerOnly(username: string, authUsername: string | undefined): void {
  if (authUsername !== username) {
    throw redirect({
      to: "/u/$username",
      params: { username },
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
