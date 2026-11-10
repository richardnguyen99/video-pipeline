import { createFileRoute } from "@tanstack/react-router";

import {
  StudioOverallAnalytics,
  StudioOverallAnalyticsSkeleton,
} from "@/layouts/video/studio/studio-overall-analytics";

export const Route = createFileRoute("/_authenticated/studio/analytics/")({
  ssr: false,
  pendingComponent: StudioOverallAnalyticsSkeleton,
  component: StudioAnalyticsOverallPage,
});

function StudioAnalyticsOverallPage() {
  return <StudioOverallAnalytics metric="overall" />;
}
