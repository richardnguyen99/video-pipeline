import { createServerFn } from "@tanstack/react-start";

import type { VideoUploadStatusResponse } from "@/queries/video-upload";

/**
 * Resolve upload status on the server using the refresh cookie
 * (or a Bearer token already obtained earlier in the same SSR request).
 * Seeds the dehydrated query cache so hard refresh does not 401.
 */
export const fetchVideoUploadStatusServer = createServerFn({
  method: "POST",
})
  .validator((data: { publicId: string }) => data)
  .handler(async ({ data }): Promise<VideoUploadStatusResponse | null> => {
    const { resolveVideoUploadStatus } = await import("./video-upload.impl.server");

    return resolveVideoUploadStatus(data.publicId);
  });
