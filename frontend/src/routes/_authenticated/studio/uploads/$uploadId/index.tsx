import { createFileRoute } from "@tanstack/react-router";

import { UploadOverview, UploadOverviewSkeleton } from "@/layouts/studio/uploads/overview";

import { Route as UploadDetailRoute } from "./route";

export const Route = createFileRoute("/_authenticated/studio/uploads/$uploadId/")({
  ssr: true,
  pendingComponent: UploadOverviewPending,
  component: UploadOverviewPage,
});

function UploadOverviewPending() {
  return <UploadOverviewSkeleton />;
}

function UploadOverviewPage() {
  const { status } = UploadDetailRoute.useLoaderData();
  const { uploadId } = Route.useParams();

  return <UploadOverview key={uploadId} uploadId={uploadId} initialStatus={status} />;
}
