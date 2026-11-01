import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaStep } from "@/layouts/video/studio/steps/media-step";
import { videoUploadStatusQueryKey, videoUploadStatusQueryOptions } from "@/queries/video-upload";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";

type UploadMediaEditorProps = {
  uploadId: string;
  initialStatus?: VideoUploadStatusResponse | null;
};

export function UploadMediaEditor({ uploadId, initialStatus = null }: UploadMediaEditorProps) {
  const statusQuery = useQuery({
    ...videoUploadStatusQueryOptions(uploadId),
    initialData: initialStatus ?? undefined,
    queryKey: videoUploadStatusQueryKey(uploadId),
  });

  const status = statusQuery.data ?? initialStatus;

  if (status == null && statusQuery.isLoading) {
    return <UploadMediaEditorSkeleton />;
  }

  if (status == null) {
    return (
      <section className="bg-card flex flex-col gap-3 rounded-xl border p-6">
        <h1 className="text-lg font-semibold">Upload not found</h1>

        <p className="text-muted-foreground text-sm">This upload could not be loaded.</p>

        <Button
          type="button"
          variant="outline"
          className="w-fit"
          nativeButton={false}
          render={<Link to="/studio/uploads" />}
        >
          Back to uploads
        </Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Media</h1>

        <p className="text-muted-foreground text-sm">Manage thumbnails and sample images for {status.video_id}.</p>
      </div>

      <section className="bg-card rounded-xl border p-5 sm:p-6">
        <MediaStep publicId={status.public_id} />
      </section>
    </div>
  );
}

export function UploadMediaEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading media">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <section className="bg-card flex flex-col gap-4 rounded-xl border p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </section>
    </div>
  );
}
