import { createFileRoute } from "@tanstack/react-router";

import {
  StudioOverallAnalytics,
  StudioOverallAnalyticsSkeleton,
} from "@/layouts/video/studio/studio-overall-analytics";

export const Route = createFileRoute("/_authenticated/studio/analytics/comments")({
  ssr: false,
  pendingComponent: StudioOverallAnalyticsSkeleton,
  component: StudioAnalyticsCommentsPage,
});

function StudioAnalyticsCommentsPage() {
  return <StudioOverallAnalytics metric="comments" />;
}
