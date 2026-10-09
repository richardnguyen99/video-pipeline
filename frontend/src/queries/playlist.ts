import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import type { Video } from "@/mocks/videos";

export type PlaylistVisibility = "public" | "restricted" | "private";

export type PlaylistSummary = {
  id: string;
  owner_id: string;
  owner_username: string;
  name: string;
  description: string | null;
  visibility: PlaylistVisibility;
  video_count: number;
  thumbnail_url?: string | null;
  contains_video?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type PlaylistDetail = PlaylistSummary & {
  videos: Array<Video>;
};

export type PlaylistListPage = {
  items: Array<PlaylistSummary>;
  total: number;
  limit: number;
  offset: number;
};

export type CreatePlaylistInput = {
  name: string;
  description?: string | null;
  visibility?: PlaylistVisibility;
};

export type PlaylistShare = {
  user_id: string;
  username: string;
  display_name: string | null;
  created_at: string;
};

export type PlaylistShareList = {
  items: Array<PlaylistShare>;
  total: number;
};

export const playlistQueryKeys = {
  all: ["playlists"] as const,
  list: (limit: number, offset: number, videoId?: number) =>
    [...playlistQueryKeys.all, "list", { limit, offset, videoId: videoId ?? null }] as const,
  shared: (limit: number, offset: number) => [...playlistQueryKeys.all, "shared", { limit, offset }] as const,
  detail: (playlistId: string) => [...playlistQueryKeys.all, "detail", playlistId] as const,
  byUsername: (username: string, limit: number, offset: number) =>
    [...playlistQueryKeys.all, "user", username, { limit, offset }] as const,
  shares: (playlistId: string) => [...playlistQueryKeys.all, "shares", playlistId] as const,
};

export async function fetchPlaylists(options?: {
  limit?: number;
  offset?: number;
  videoId?: number;
}): Promise<PlaylistListPage> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const searchParams: Record<string, string | number> = { limit, offset };

  if (options?.videoId != null) {
    searchParams.video_id = options.videoId;
  }

  return apiFetch<PlaylistListPage>("/playlists", {
    searchParams,
  });
}

export async function fetchPlaylistDetail(playlistId: string): Promise<PlaylistDetail> {
  return apiFetch<PlaylistDetail>(`/playlists/${playlistId}`);
}

export async function createPlaylist(input: CreatePlaylistInput): Promise<PlaylistSummary> {
  return apiFetch<PlaylistSummary>("/playlists", {
    method: "POST",
    data: {
      name: input.name,
      description: input.description ?? null,
      visibility: input.visibility ?? "private",
    },
  });
}

export async function addVideoToPlaylist(playlistId: string, videoId: number): Promise<PlaylistSummary> {
  return apiFetch<PlaylistSummary>(`/playlists/${playlistId}/videos`, {
    method: "POST",
    data: { video_id: videoId },
  });
}

export async function removeVideoFromPlaylist(playlistId: string, videoId: number): Promise<PlaylistSummary> {
  return apiFetch<PlaylistSummary>(`/playlists/${playlistId}/videos/${videoId}`, {
    method: "DELETE",
  });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await apiFetch<void>(`/playlists/${playlistId}`, {
    method: "DELETE",
  });
}

export type UpdatePlaylistInput = {
  name?: string;
  description?: string | null;
  visibility?: PlaylistVisibility;
};

export async function updatePlaylist(playlistId: string, input: UpdatePlaylistInput): Promise<PlaylistSummary> {
  return apiFetch<PlaylistSummary>(`/playlists/${playlistId}`, {
    method: "PATCH",
    data: input,
  });
}

export async function changePlaylistVisibility(
  playlistId: string,
  visibility: PlaylistVisibility,
): Promise<PlaylistSummary> {
  return apiFetch<PlaylistSummary>(`/playlists/${playlistId}/visibility`, {
    method: "PATCH",
    data: { visibility },
  });
}

export async function fetchPlaylistShares(playlistId: string): Promise<PlaylistShareList> {
  return apiFetch<PlaylistShareList>(`/playlists/${playlistId}/shares`);
}

export async function addPlaylistShare(playlistId: string, username: string): Promise<PlaylistShare> {
  return apiFetch<PlaylistShare>(`/playlists/${playlistId}/shares`, {
    method: "POST",
    data: { username },
  });
}

export async function removePlaylistShare(playlistId: string, userId: string): Promise<void> {
  await apiFetch<void>(`/playlists/${playlistId}/shares/${userId}`, {
    method: "DELETE",
  });
}

export function playlistSharesQueryOptions(playlistId: string) {
  return queryOptions({
    queryKey: playlistQueryKeys.shares(playlistId),
    queryFn: () => fetchPlaylistShares(playlistId),
    staleTime: 15_000,
  });
}

export function playlistsQueryOptions(options?: { limit?: number; offset?: number; videoId?: number }) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const videoId = options?.videoId;

  return queryOptions({
    queryKey: playlistQueryKeys.list(limit, offset, videoId),
    queryFn: () => fetchPlaylists({ limit, offset, videoId }),
    staleTime: 30_000,
  });
}

export async function fetchSharedPlaylists(options?: { limit?: number; offset?: number }): Promise<PlaylistListPage> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return apiFetch<PlaylistListPage>("/playlists/shared", {
    searchParams: { limit, offset },
  });
}

export function sharedPlaylistsQueryOptions(options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return queryOptions({
    queryKey: playlistQueryKeys.shared(limit, offset),
    queryFn: () => fetchSharedPlaylists({ limit, offset }),
    staleTime: 30_000,
  });
}

export function playlistDetailQueryOptions(playlistId: string) {
  return queryOptions({
    queryKey: playlistQueryKeys.detail(playlistId),
    queryFn: () => fetchPlaylistDetail(playlistId),
    staleTime: 30_000,
  });
}

export async function fetchPublicPlaylistsByUsername(
  username: string,
  options?: {
    limit?: number;
    offset?: number;
  },
): Promise<PlaylistListPage> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return apiFetch<PlaylistListPage>(`/users/${username}/playlists`, {
    searchParams: { limit, offset },
  });
}

export function publicPlaylistsByUsernameQueryOptions(
  username: string,
  options?: {
    limit?: number;
    offset?: number;
  },
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return queryOptions({
    queryKey: playlistQueryKeys.byUsername(username, limit, offset),
    queryFn: () => fetchPublicPlaylistsByUsername(username, { limit, offset }),
    staleTime: 30_000,
  });
}
