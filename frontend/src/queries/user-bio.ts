import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type UserBio = {
  full_name: string | null;
  date_of_birth: string | null;
  country: string | null;
  gender: string | null;
  biography: string | null;
  link: string | null;
  updated_at: string | null;
};

export type UserBioUpdatePayload = {
  full_name?: string | null;
  date_of_birth?: string | null;
  country?: string | null;
  gender?: string | null;
  biography?: string | null;
  link?: string | null;
};

export const userBioQueryKeys = {
  all: ["user-bio"] as const,
  byUsername: (username: string) => ["user-bio", username] as const,
  me: ["user-bio", "me"] as const,
};

export function emptyUserBio(): UserBio {
  return {
    full_name: null,
    date_of_birth: null,
    country: null,
    gender: null,
    biography: null,
    link: null,
    updated_at: null,
  };
}

export async function fetchPublicUserBio(username: string): Promise<UserBio> {
  return apiFetch<UserBio>(`/users/${encodeURIComponent(username)}/bio`);
}

export async function fetchMyUserBio(): Promise<UserBio> {
  return apiFetch<UserBio>("/auth/bio");
}

export async function updateMyUserBio(payload: UserBioUpdatePayload): Promise<UserBio> {
  return apiFetch<UserBio>("/auth/bio", {
    method: "PUT",
    data: payload,
  });
}

export function publicUserBioQueryOptions(username: string) {
  return queryOptions({
    queryKey: userBioQueryKeys.byUsername(username),
    queryFn: () => fetchPublicUserBio(username),
    staleTime: 60_000,
  });
}

export function myUserBioQueryOptions() {
  return queryOptions({
    queryKey: userBioQueryKeys.me,
    queryFn: () => fetchMyUserBio(),
    staleTime: 60_000,
  });
}

export function updateUserBioMutationOptions() {
  return mutationOptions({
    mutationFn: (payload: UserBioUpdatePayload) => updateMyUserBio(payload),
  });
}
