import { queryOptions } from "@tanstack/react-query";

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

export type UserVideoItem = {
  id: string;
  title: string;
  views: number;
};

export type UserPlaylistItem = {
  id: string;
  title: string;
  video_count: number;
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
    queryKey: ["user-profile", username] as const,
    queryFn: (): PublicUserProfile => buildPublicProfile(username),
    staleTime: 60_000,
  });
}

export function userFollowedCreatorsQueryOptions(username: string) {
  return queryOptions({
    queryKey: ["user-followed", username] as const,
    queryFn: (): Array<FollowedCreator> => DEMO_FOLLOWED,
    staleTime: 60_000,
  });
}

export function userVideosQueryOptions(username: string) {
  return queryOptions({
    queryKey: ["user-videos", username] as const,
    queryFn: (): Array<UserVideoItem> => [],
    staleTime: 60_000,
  });
}

export function userPlaylistsQueryOptions(username: string) {
  return queryOptions({
    queryKey: ["user-playlists", username] as const,
    queryFn: (): Array<UserPlaylistItem> => DEMO_PLAYLISTS,
    staleTime: 60_000,
  });
}
