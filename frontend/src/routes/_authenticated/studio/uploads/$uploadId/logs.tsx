import { createFileRoute } from "@tanstack/react-router";

import { UploadLogs, UploadLogsSkeleton } from "@/layouts/studio/uploads/logs";

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/logs")({
  ssr: false,
  pendingComponent: UploadLogsSkeleton,
  component: StudioUploadLogsPage,
});

function StudioUploadLogsPage() {
  const { uploadId } = Route.useParams();

  return <UploadLogs uploadId={uploadId} />;
}
