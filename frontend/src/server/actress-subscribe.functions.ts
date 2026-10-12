import { createServerFn } from "@tanstack/react-start";

import type { ActressSubscribeStatusApi } from "@/queries/actress-subscribe";

/**
 * Resolve actress subscription status on the server using the refresh cookie
 * (or a Bearer token already obtained earlier in the same SSR request).
 * Seeds the dehydrated query cache so the subscribe button does not flash.
 *
 * Cookie / token resolution lives in ``actress-subscribe.impl.server`` so this
 * module stays free of ``@tanstack/react-start/server`` imports.
 */
export const fetchActressSubscribeStatusServer = createServerFn({
  method: "POST",
})
  .validator((data: { actressId: number }) => data)
  .handler(async ({ data }): Promise<ActressSubscribeStatusApi | null> => {
    const { resolveActressSubscribeStatus } = await import("./actress-subscribe.impl.server");

    return resolveActressSubscribeStatus(data.actressId);
  });
