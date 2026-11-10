import { createFileRoute } from "@tanstack/react-router";

import { StudioOverallAnalytics, StudioOverallAnalyticsSkeleton } from "@/layouts/studio/analytics/overall-analytics";

export const Route = createFileRoute("/_authenticated/studio/analytics/views")({
  ssr: false,
  pendingComponent: StudioOverallAnalyticsSkeleton,
  component: StudioAnalyticsViewsPage,
});

function StudioAnalyticsViewsPage() {
  return <StudioOverallAnalytics metric="views" />;
}
