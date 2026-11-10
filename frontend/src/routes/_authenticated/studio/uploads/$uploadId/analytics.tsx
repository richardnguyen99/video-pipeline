import { createFileRoute } from "@tanstack/react-router";

import { StudioAnalytics, StudioAnalyticsSkeleton } from "@/layouts/studio/analytics/upload-analytics";

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/analytics")({
  ssr: false,
  pendingComponent: StudioAnalyticsSkeleton,
  component: StudioUploadAnalyticsPage,
});

function StudioUploadAnalyticsPage() {
  const { uploadId } = Route.useParams();

  return <StudioAnalytics uploadId={uploadId} />;
}
