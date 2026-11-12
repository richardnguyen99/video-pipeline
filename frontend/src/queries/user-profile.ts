import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { Video } from "@/types/video";

export type PublicUserProfile = {
  username: string;
  display_name: string;
  bio: string;
  location: string;
  creator_tag: string;
  is_public: boolean;
};

export type FollowedCreator = {
  id: string;
  name: string;
  role: "Creator" | "Actress";
  initials: string;
};

export type UserPlaylistItem = {
  id: string;
  title: string;
  video_count: number;
};

export type PublicUserVideosPage = {
  items: Array<Video>;
  total: number;
  limit: number;
  offset: number;
};

export const PUBLIC_USER_VIDEOS_PAGE_SIZE = 12;

export const userProfileQueryKeys = {
  all: ["user-profile"] as const,
  profile: (username: string) => [...userProfileQueryKeys.all, username] as const,
  followed: (username: string) => ["user-followed", username] as const,
  videos: (username: string, limit: number, offset: number) => ["user-videos", username, { limit, offset }] as const,
  videosInfinite: (username: string, limit: number) => ["user-videos", username, "infinite", { limit }] as const,
  playlists: (username: string) => ["user-playlists", username] as const,
};

const DEMO_FOLLOWED: Array<FollowedCreator> = [
  { id: "1", name: "Maya Chen", role: "Creator", initials: "MC" },
  { id: "2", name: "Noah Williams", role: "Actress", initials: "NW" },
  { id: "3", name: "Sofia Laurent", role: "Creator", initials: "SL" },
];

const DEMO_PLAYLISTS: Array<UserPlaylistItem> = [
  { id: "1", title: "Slow cinema Sundays", video_count: 5 },
  { id: "2", title: "Field notes: California", video_count: 4 },
  { id: "3", title: "The good kind of quiet", video_count: 6 },
];

function buildPublicProfile(username: string): PublicUserProfile {
  return {
    username,
    display_name: username
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    bio: "Director, editor, and lifelong collector of small moments.",
    location: "San Francisco, CA",
    creator_tag: "Filmmaker & storyteller",
    is_public: true,
  };
}

export function publicUserProfileQueryOptions(username: string) {
  return queryOptions({
    queryKey: userProfileQueryKeys.profile(username),
    queryFn: (): PublicUserProfile => buildPublicProfile(username),
    staleTime: 60_000,
  });
}

export function userFollowedCreatorsQueryOptions(username: string) {
  return queryOptions({
    queryKey: userProfileQueryKeys.followed(username),
    queryFn: (): Array<FollowedCreator> => DEMO_FOLLOWED,
    staleTime: 60_000,
  });
}

export async function fetchPublicUserVideos(
  username: string,
  options?: { limit?: number; offset?: number },
): Promise<PublicUserVideosPage> {
  const limit = options?.limit ?? PUBLIC_USER_VIDEOS_PAGE_SIZE;
  const offset = options?.offset ?? 0;

  return apiFetch<PublicUserVideosPage>(`/users/${encodeURIComponent(username)}/videos`, {
    searchParams: { limit, offset },
  });
}

export function userVideosQueryOptions(username: string, options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? PUBLIC_USER_VIDEOS_PAGE_SIZE;
  const offset = options?.offset ?? 0;

  return queryOptions({
    queryKey: userProfileQueryKeys.videos(username, limit, offset),
    queryFn: () => fetchPublicUserVideos(username, { limit, offset }),
    staleTime: 30_000,
  });
}

export function userVideosInfiniteQueryOptions(username: string, options?: { limit?: number }) {
  const limit = options?.limit ?? PUBLIC_USER_VIDEOS_PAGE_SIZE;

  return infiniteQueryOptions({
    queryKey: userProfileQueryKeys.videosInfinite(username, limit),
    queryFn: ({ pageParam }) => fetchPublicUserVideos(username, { limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length === 0) {
        return undefined;
      }

      if (lastPage.items.length < lastPage.limit) {
        return undefined;
      }

      const nextOffset = lastPage.offset + lastPage.items.length;

      if (typeof lastPage.total === "number" && lastPage.total > 0 && nextOffset >= lastPage.total) {
        return undefined;
      }

      return nextOffset;
    },
    staleTime: 30_000,
  });
}

export function userPlaylistsQueryOptions(username: string) {
  return queryOptions({
    queryKey: userProfileQueryKeys.playlists(username),
    queryFn: (): Array<UserPlaylistItem> => DEMO_PLAYLISTS,
    staleTime: 60_000,
  });
}
