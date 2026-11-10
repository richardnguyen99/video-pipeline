import { createFileRoute } from "@tanstack/react-router";

import { StudioOverallAnalytics, StudioOverallAnalyticsSkeleton } from "@/layouts/studio/analytics/overall-analytics";

export const Route = createFileRoute("/_authenticated/studio/analytics/comments")({
  ssr: false,
  pendingComponent: StudioOverallAnalyticsSkeleton,
  component: StudioAnalyticsCommentsPage,
});

function StudioAnalyticsCommentsPage() {
  return <StudioOverallAnalytics metric="comments" />;
}
