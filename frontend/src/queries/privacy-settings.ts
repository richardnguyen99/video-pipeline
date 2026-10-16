import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type PrivacySettings = {
  id: string | null;
  show_watched_videos: boolean;
  show_liked_videos: boolean;
  show_subscriptions: boolean;
  show_comment_history: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type PrivacySettingsUpdateRequest = {
  show_watched_videos: boolean;
  show_liked_videos: boolean;
  show_subscriptions: boolean;
  show_comment_history: boolean;
};

export const privacySettingsQueryKeys = {
  all: ["privacy-settings"] as const,
  me: () => [...privacySettingsQueryKeys.all, "me"] as const,
};

export async function fetchMyPrivacySettings(): Promise<PrivacySettings> {
  return apiFetch<PrivacySettings>("/users/me/privacy-settings");
}

export async function updateMyPrivacySettings(payload: PrivacySettingsUpdateRequest): Promise<PrivacySettings> {
  return apiFetch<PrivacySettings>("/users/me/privacy-settings", {
    method: "PUT",
    data: payload,
  });
}

export function myPrivacySettingsQueryOptions() {
  return queryOptions({
    queryKey: privacySettingsQueryKeys.me(),
    queryFn: fetchMyPrivacySettings,
  });
}
