import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type PlaylistVisibility = "public" | "private";

export type PlaylistSummary = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  visibility: PlaylistVisibility;
  video_count: number;
  thumbnail_url?: string | null;
  contains_video?: boolean | null;
  created_at: string;
  updated_at: string;
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

export const playlistQueryKeys = {
  all: ["playlists"] as const,
  list: (limit: number, offset: number, videoId?: number) =>
    [...playlistQueryKeys.all, "list", { limit, offset, videoId: videoId ?? null }] as const,
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
