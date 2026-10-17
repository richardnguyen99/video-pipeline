import { createServerFn } from "@tanstack/react-start";

import type { BlockedAccountListResponse } from "@/queries/blocked-accounts";

/**
 * Resolve blocked accounts on the server using the refresh cookie
 * (or a Bearer token already obtained earlier in the same SSR request).
 * Seeds the dehydrated query cache so the page does not flash a loading state
 * on hard refresh.
 */
export const fetchMyBlockedAccountsServer = createServerFn({
  method: "POST",
}).handler(async (): Promise<BlockedAccountListResponse | null> => {
  const { resolveMyBlockedAccounts } = await import("./blocked-accounts.impl.server");

  return resolveMyBlockedAccounts();
});
