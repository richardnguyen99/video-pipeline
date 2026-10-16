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

/** Display locale for aka-translated preference labels. */
export const CONTENT_PREFERENCE_LOCALE = "en-us";

export const contentPreferenceQueryKeys = {
  all: ["content-preferences"] as const,
  me: (locale: string = CONTENT_PREFERENCE_LOCALE) => [...contentPreferenceQueryKeys.all, "me", locale] as const,
};

export async function fetchMyContentPreferences(
  locale: string = CONTENT_PREFERENCE_LOCALE,
): Promise<ContentPreferenceListResponse> {
  return apiFetch<ContentPreferenceListResponse>("/users/me/content-preferences", {
    searchParams: { locale },
  });
}

export async function upsertContentPreference(
  payload: ContentPreferenceCreateRequest,
  locale: string = CONTENT_PREFERENCE_LOCALE,
): Promise<ContentPreferenceItem> {
  return apiFetch<ContentPreferenceItem>("/users/me/content-preferences", {
    method: "POST",
    data: payload,
    searchParams: { locale },
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

export function myContentPreferencesQueryOptions(locale: string = CONTENT_PREFERENCE_LOCALE) {
  return queryOptions({
    queryKey: contentPreferenceQueryKeys.me(locale),
    queryFn: () => fetchMyContentPreferences(locale),
  });
}
