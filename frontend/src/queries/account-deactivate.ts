import { apiFetch } from "@/libs/api-client";

export type DeactivateAccountResponse = {
  id: string;
  username: string;
  is_active: boolean;
  deactivated_at: string;
};

export async function deactivateMyAccount(): Promise<DeactivateAccountResponse> {
  return apiFetch<DeactivateAccountResponse>("/users/me/deactivate", {
    method: "POST",
    skipAuthRefresh: true,
  });
}
