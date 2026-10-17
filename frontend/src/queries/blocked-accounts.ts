import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/libs/api-client";

export type BlockedAccount = {
  id: string;
  username: string;
  display_name: string | null;
  initials: string;
  blocked_at: string;
};

export type BlockedAccountListResponse = {
  items: Array<BlockedAccount>;
  total: number;
};

export type BlockUserRequest = {
  user_id?: string;
  username?: string;
};

export const blockedAccountsQueryKeys = {
  all: ["blocked-accounts"] as const,
  me: () => [...blockedAccountsQueryKeys.all, "me"] as const,
};

export async function fetchMyBlockedAccounts(): Promise<BlockedAccountListResponse> {
  return apiFetch<BlockedAccountListResponse>("/users/me/blocked-accounts");
}

export async function blockUser(payload: BlockUserRequest): Promise<BlockedAccount> {
  return apiFetch<BlockedAccount>("/users/me/blocked-accounts", {
    method: "POST",
    data: payload,
  });
}

export async function unblockUser(blockedUserId: string): Promise<void> {
  await apiFetch<void>(`/users/me/blocked-accounts/${blockedUserId}`, {
    method: "DELETE",
  });
}

export function myBlockedAccountsQueryOptions() {
  return queryOptions({
    queryKey: blockedAccountsQueryKeys.me(),
    queryFn: fetchMyBlockedAccounts,
  });
}
