import { createFileRoute } from "@tanstack/react-router";

import { UploadMetadataEditor, UploadMetadataEditorSkeleton } from "@/layouts/studio/uploads/metadata-editor";

import { Route as UploadDetailRoute } from "./route";

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/metadata")({
  ssr: true,
  pendingComponent: UploadMetadataPending,
  component: UploadMetadataPage,
});

function UploadMetadataPending() {
  return <UploadMetadataEditorSkeleton />;
}

function UploadMetadataPage() {
  const { status } = UploadDetailRoute.useLoaderData();
  const { uploadId } = Route.useParams();

  return <UploadMetadataEditor key={uploadId} uploadId={uploadId} initialStatus={status} />;
}
