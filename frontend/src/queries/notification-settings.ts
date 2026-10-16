import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type PreferredLanguage = "en" | "es" | "fr" | "ja" | "de";

export type NotificationSettings = {
  id: string | null;
  preferred_language: PreferredLanguage;
  notify_followed_videos: boolean;
  notify_public_video_activity: boolean;
  notify_public_playlist_activity: boolean;
  notify_comment_replies: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type NotificationSettingsUpdateRequest = {
  preferred_language: PreferredLanguage;
  notify_followed_videos: boolean;
  notify_public_video_activity: boolean;
  notify_public_playlist_activity: boolean;
  notify_comment_replies: boolean;
};

export const notificationSettingsQueryKeys = {
  all: ["notification-settings"] as const,
  me: () => [...notificationSettingsQueryKeys.all, "me"] as const,
};

export async function fetchMyNotificationSettings(): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>("/users/me/notification-settings");
}

export async function updateMyNotificationSettings(
  payload: NotificationSettingsUpdateRequest,
): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>("/users/me/notification-settings", {
    method: "PUT",
    data: payload,
  });
}

export function myNotificationSettingsQueryOptions() {
  return queryOptions({
    queryKey: notificationSettingsQueryKeys.me(),
    queryFn: fetchMyNotificationSettings,
  });
}
