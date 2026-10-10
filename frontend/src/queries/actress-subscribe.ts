import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";
import { formatAge } from "@/libs/actresses";

export type ActressSubscribeImageApi = {
  id: number;
  url: string;
  attribute: "thumbnail" | "default" | "avatar" | string;
};

export type ActressSubscribeItemApi = {
  actress_id: number;
  name: string;
  image_url?: string | null;
  ruby?: string | null;
  birthday?: string | null;
  bust?: number | null;
  cup?: string | null;
  waist?: number | null;
  hip?: number | null;
  height?: number | null;
  view_cnt?: number;
  like_cnt?: number;
  image?: Array<ActressSubscribeImageApi> | null;
  subscribed_at: string;
};

export type ActressSubscribeListApiResponse = {
  items: Array<ActressSubscribeItemApi>;
  total: number;
  limit: number;
  offset: number;
};

export type ActressSubscribeStatusApi = {
  actress_id: number;
  is_subscribed: boolean;
  sub_cnt: number;
};

export type ActressSubscription = {
  actressId: number;
  name: string;
  imageUrl: string | null;
  ruby: string | null;
  birthday: string | null;
  bust: number | null;
  cup: string | null;
  waist: number | null;
  hip: number | null;
  height: number | null;
  viewCount: number;
  likeCount: number;
  age: number | null;
  measurementLabel: string | null;
  subscribedAt: string;
};

/**
 * Prefer attribute order: default (1 / small) → thumbnail (0) → avatar (2).
 */
export function pickSubscribeImageUrl(
  images: Array<ActressSubscribeImageApi> | null | undefined,
  fallback?: string | null,
): string | null {
  if (images != null && images.length > 0) {
    const byAttr = (attr: string) => images.find((img) => img.attribute.toLowerCase() === attr);

    const preferred = byAttr("default") ?? byAttr("thumbnail") ?? byAttr("avatar") ?? images[0];

    if (preferred.url !== "") {
      return preferred.url;
    }
  }

  if (fallback != null && fallback !== "") {
    return fallback;
  }

  return null;
}

function formatSubscribeMeasurements(item: ActressSubscribeItemApi): string | null {
  const parts: Array<string> = [];

  if (item.bust != null) {
    parts.push(item.cup ? `B${item.bust}${item.cup}` : `B${item.bust}`);
  } else if (item.cup) {
    parts.push(`Cup ${item.cup}`);
  }

  if (item.waist != null) {
    parts.push(`W${item.waist}`);
  }

  if (item.hip != null) {
    parts.push(`H${item.hip}`);
  }

  if (item.height != null) {
    parts.push(`${item.height}cm`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function mapActressSubscribeItem(item: ActressSubscribeItemApi): ActressSubscription {
  return {
    actressId: item.actress_id,
    name: item.name,
    imageUrl: pickSubscribeImageUrl(item.image, item.image_url),
    ruby: item.ruby ?? null,
    birthday: item.birthday ?? null,
    bust: item.bust ?? null,
    cup: item.cup ?? null,
    waist: item.waist ?? null,
    hip: item.hip ?? null,
    height: item.height ?? null,
    viewCount: item.view_cnt ?? 0,
    likeCount: item.like_cnt ?? 0,
    age: formatAge(item.birthday),
    measurementLabel: formatSubscribeMeasurements(item),
    subscribedAt: item.subscribed_at,
  };
}

export const actressSubscribeQueryKeys = {
  all: ["actress-subscriptions"] as const,
  byUsername: (username: string) => [...actressSubscribeQueryKeys.all, "user", username] as const,
  me: () => [...actressSubscribeQueryKeys.all, "me"] as const,
  status: (actressId: number) => [...actressSubscribeQueryKeys.all, "status", actressId] as const,
};

export async function fetchUserActressSubscriptions(
  username: string,
  options?: { limit?: number; offset?: number },
): Promise<ActressSubscribeListApiResponse> {
  return apiFetch<ActressSubscribeListApiResponse>(`/users/${encodeURIComponent(username)}/actress-subscriptions`, {
    searchParams: {
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    },
  });
}

export async function fetchMyActressSubscriptions(options?: {
  limit?: number;
  offset?: number;
}): Promise<ActressSubscribeListApiResponse> {
  return apiFetch<ActressSubscribeListApiResponse>("/users/me/actress-subscriptions", {
    searchParams: {
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    },
  });
}

export async function subscribeToActress(actressId: number): Promise<ActressSubscribeStatusApi> {
  return apiFetch<ActressSubscribeStatusApi>(`/actresses/${actressId}/subscribe`, {
    method: "POST",
  });
}

export async function unsubscribeFromActress(actressId: number): Promise<ActressSubscribeStatusApi> {
  return apiFetch<ActressSubscribeStatusApi>(`/actresses/${actressId}/subscribe`, {
    method: "DELETE",
  });
}

export function userActressSubscriptionsQueryOptions(username: string) {
  return queryOptions({
    queryKey: actressSubscribeQueryKeys.byUsername(username),
    queryFn: async (): Promise<Array<ActressSubscription>> => {
      const response = await fetchUserActressSubscriptions(username, {
        limit: 50,
        offset: 0,
      });

      return response.items.map(mapActressSubscribeItem);
    },
    staleTime: 30_000,
  });
}
