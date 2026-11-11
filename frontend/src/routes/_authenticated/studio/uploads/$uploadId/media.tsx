import { createFileRoute } from "@tanstack/react-router";

import { UploadMediaEditor, UploadMediaEditorSkeleton } from "@/layouts/studio/uploads/media-editor";

import { Route as UploadDetailRoute } from "./route";

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/media")({
  ssr: true,
  pendingComponent: UploadMediaPending,
  component: UploadMediaPage,
});

function UploadMediaPending() {
  return <UploadMediaEditorSkeleton />;
}

function UploadMediaPage() {
  const { status } = UploadDetailRoute.useLoaderData();
  const { uploadId } = Route.useParams();

  return <UploadMediaEditor key={uploadId} uploadId={uploadId} initialStatus={status} />;
}
