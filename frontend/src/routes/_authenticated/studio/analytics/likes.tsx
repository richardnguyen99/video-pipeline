import { createFileRoute } from "@tanstack/react-router";

import {
  StudioOverallAnalytics,
  StudioOverallAnalyticsSkeleton,
} from "@/layouts/video/studio/studio-overall-analytics";

export const Route = createFileRoute("/_authenticated/studio/analytics/likes")({
  ssr: false,
  pendingComponent: StudioOverallAnalyticsSkeleton,
  component: StudioAnalyticsLikesPage,
});

function StudioAnalyticsLikesPage() {
  return <StudioOverallAnalytics metric="likes" />;
}
