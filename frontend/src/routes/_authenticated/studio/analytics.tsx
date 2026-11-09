import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { StudioAnalytics, StudioAnalyticsSkeleton } from "@/layouts/video/studio/studio-analytics";

const analyticsSearchSchema = z.object({
  uploadId: z.string().optional().catch(undefined),
  days: z.coerce.number().int().positive().max(90).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/studio/analytics")({
  ssr: false,
  validateSearch: analyticsSearchSchema,
  pendingComponent: StudioAnalyticsSkeleton,
  component: StudioAnalyticsPage,
});

function StudioAnalyticsPage() {
  const search = Route.useSearch();

  return <StudioAnalytics uploadId={search.uploadId} days={search.days ?? 7} />;
}
