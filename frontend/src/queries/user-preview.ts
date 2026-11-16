import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type UserPreview = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  biography: string | null;
};

export const userPreviewQueryKeys = {
  all: ["user-preview"] as const,
  byUsername: (username: string) => [...userPreviewQueryKeys.all, username] as const,
};

export async function fetchUserPreview(username: string): Promise<UserPreview> {
  return apiFetch<UserPreview>(`/users/${encodeURIComponent(username)}/preview`);
}

export function userPreviewQueryOptions(username: string) {
  const trimmed = username.trim();

  return queryOptions({
    queryKey: userPreviewQueryKeys.byUsername(trimmed),
    queryFn: () => fetchUserPreview(trimmed),
    enabled: trimmed.length >= 1 && trimmed !== "deleted",
    staleTime: 60_000,
    retry: false,
  });
}
