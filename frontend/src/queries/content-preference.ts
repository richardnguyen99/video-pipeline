import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type PreferencePolarity = "interest" | "dislike";

export type PreferenceEntityType = "actress" | "maker" | "genre" | "series" | "label" | "director";

export type ContentPreferenceItem = {
  id: string;
  polarity: PreferencePolarity;
  entity_type: PreferenceEntityType;
  entity_id: number;
  entity_name: string | null;
  created_at: string;
};

export type ContentPreferenceListResponse = {
  interests: Array<ContentPreferenceItem>;
  dislikes: Array<ContentPreferenceItem>;
};

export type ContentPreferenceCreateRequest = {
  polarity: PreferencePolarity;
  entity_type: PreferenceEntityType;
  entity_id: number;
};

export const contentPreferenceQueryKeys = {
  all: ["content-preferences"] as const,
  me: () => [...contentPreferenceQueryKeys.all, "me"] as const,
};

export async function fetchMyContentPreferences(): Promise<ContentPreferenceListResponse> {
  return apiFetch<ContentPreferenceListResponse>("/users/me/content-preferences");
}

export async function upsertContentPreference(payload: ContentPreferenceCreateRequest): Promise<ContentPreferenceItem> {
  return apiFetch<ContentPreferenceItem>("/users/me/content-preferences", {
    method: "POST",
    data: payload,
  });
}

export async function removeContentPreference(entityType: PreferenceEntityType, entityId: number): Promise<void> {
  await apiFetch<void>(`/users/me/content-preferences/${encodeURIComponent(entityType)}/${entityId}`, {
    method: "DELETE",
  });
}

export async function clearContentPreferences(polarity: PreferencePolarity): Promise<void> {
  await apiFetch<void>("/users/me/content-preferences", {
    method: "DELETE",
    searchParams: { polarity },
  });
}

export function myContentPreferencesQueryOptions() {
  return queryOptions({
    queryKey: contentPreferenceQueryKeys.me(),
    queryFn: fetchMyContentPreferences,
  });
}
