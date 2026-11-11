import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileVideo, FolderOpen, Upload } from "lucide-react";

import { StudioMetricsChart } from "@/components/studio/metrics-chart";
import type { StudioMetricsChartSeries } from "@/components/studio/metrics-chart";
import { formatFileSize } from "@/components/studio/upload-helpers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCompactNumber, formatRelativeDate } from "@/libs/utils";
import {
  getStudioAnalytics,
  listVideoUploads,
  studioAnalyticsQueryKey,
  VIDEO_UPLOADS_LIST_QUERY_KEY,
} from "@/queries/video-upload";
import type { StudioAnalyticsLine, VideoUploadListItem } from "@/queries/video-upload";
import { useAuthStore } from "@/stores/auth-store";

function greetingHourLabel(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function statusClass(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  }

  if (key === "ENCODING" || key === "UPLOADED" || key === "PENDING") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }

  if (key === "FAILED") {
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  }

  return "bg-muted text-muted-foreground";
}

function statusLabel(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "Published";
  }

  if (key === "ENCODING") {
    return "Processing";
  }

  if (key === "UPLOADED") {
    return "Uploaded";
  }

  if (key === "PENDING") {
    return "Pending";
  }

  if (key === "FAILED") {
    return "Failed";
  }

  return status;
}

function displayTitle(item: VideoUploadListItem): string {
  const title = item.title?.trim();

  if (title) {
    return title;
  }

  const filename = item.original_filename?.trim();

  if (filename) {
    return filename;
  }

  return item.video_id;
}

function lineTotal(lines: Array<StudioAnalyticsLine>, id: string): number {
  return lines.find((line) => line.id === id)?.total ?? 0;
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }

  return ((current - previous) / previous) * 100;
}

function splitHalfTotals(line: StudioAnalyticsLine | undefined): {
  recent: number;
  previous: number;
} {
  if (line == null || line.points.length === 0) {
    return { recent: 0, previous: 0 };
  }

  const midpoint = Math.floor(line.points.length / 2);
  const previous = line.points.slice(0, midpoint).reduce((sum, point) => sum + point.count, 0);
  const recent = line.points.slice(midpoint).reduce((sum, point) => sum + point.count, 0);

  return { recent, previous };
}

const METRIC_COLORS: Record<string, string> = {
  views: "#3b82f6",
  likes: "#f43f5e",
  comments: "#f59e0b",
};

function metricsSeries(lines: Array<StudioAnalyticsLine>): Array<StudioMetricsChartSeries> {
  return lines
    .filter((line) => line.kind === "metric")
    .map((line) => ({
      key: line.id,
      label: line.label,
      color: METRIC_COLORS[line.id] ?? "#a78bfa",
      points: line.points,
      total: line.total,
      videoId: line.video_id,
    }));
}

export function StudioDashboard() {
  const user = useAuthStore((state) => state.user);

  const displayName = useMemo(() => {
    return user?.display_name?.trim() || user?.username || "Creator";
  }, [user]);

  const greeting = `${greetingHourLabel()}, ${displayName}.`;

  const analyticsMonth = useQuery({
    queryKey: studioAnalyticsQueryKey("overall", "months"),
    queryFn: () => getStudioAnalytics("overall", "months"),
    staleTime: 30_000,
  });

  const analyticsAll = useQuery({
    queryKey: studioAnalyticsQueryKey("overall", "all"),
    queryFn: () => getStudioAnalytics("overall", "all"),
    staleTime: 60_000,
  });

  const uploadsQuery = useQuery({
    queryKey: [...VIDEO_UPLOADS_LIST_QUERY_KEY, "dashboard", 8],
    queryFn: () => listVideoUploads({ limit: 8, offset: 0 }),
    staleTime: 30_000,
  });

  const monthLines = analyticsMonth.data?.lines ?? [];
  const allLines = analyticsAll.data?.lines ?? [];

  const totalViews = lineTotal(allLines, "views");
  const totalLikes = lineTotal(allLines, "likes");
  const totalComments = lineTotal(allLines, "comments");

  const viewsSplit = splitHalfTotals(monthLines.find((line) => line.id === "views"));
  const likesSplit = splitHalfTotals(monthLines.find((line) => line.id === "likes"));
  const commentsSplit = splitHalfTotals(monthLines.find((line) => line.id === "comments"));

  const viewsDelta = percentChange(viewsSplit.recent, viewsSplit.previous);
  const likesDelta = percentChange(likesSplit.recent, likesSplit.previous);
  const commentsDelta = percentChange(commentsSplit.recent, commentsSplit.previous);

  const uploads = uploadsQuery.data?.items ?? [];
  const publishedCount = uploadsQuery.data?.items.filter((item) => item.status.toUpperCase() === "READY").length ?? 0;
  const publishedTotal = uploadsQuery.data?.total ?? 0;

  const chartSeries = metricsSeries(monthLines);
  const statsLoading =
    (analyticsAll.isLoading && typeof analyticsAll.data === "undefined") ||
    (uploadsQuery.isLoading && typeof uploadsQuery.data === "undefined");
  const chartLoading = analyticsMonth.isLoading && typeof analyticsMonth.data === "undefined";
  const recentLoading = uploadsQuery.isLoading && typeof uploadsQuery.data === "undefined";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Creator workspace</span>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting}</h1>

          <p className="text-muted-foreground text-sm">Here is what is happening with your channel.</p>
        </div>

        <Button type="button" nativeButton={false} render={<Link to="/studio/uploads/new" />}>
          <Upload data-icon="inline-start" className="size-4" />
          Upload video
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            {
              label: "Total views",
              value: formatCompactNumber(totalViews),
              note:
                viewsDelta == null
                  ? "No comparison yet"
                  : `${viewsDelta >= 0 ? "+" : ""}${viewsDelta.toFixed(1)}% this month`,
              positive: viewsDelta == null ? false : viewsDelta >= 0,
            },
            {
              label: "Uploads",
              value: String(publishedTotal),
              note: `${String(publishedCount)} ready of ${String(uploads.length)} recent`,
              positive: false,
            },
            {
              label: "Total likes",
              value: formatCompactNumber(totalLikes),
              note:
                likesDelta == null
                  ? "No comparison yet"
                  : `${likesDelta >= 0 ? "+" : ""}${likesDelta.toFixed(1)}% this month`,
              positive: likesDelta == null ? false : likesDelta >= 0,
            },
            {
              label: "Total comments",
              value: formatCompactNumber(totalComments),
              note:
                commentsDelta == null
                  ? "No comparison yet"
                  : `${commentsDelta >= 0 ? "+" : ""}${commentsDelta.toFixed(1)}% this month`,
              positive: commentsDelta == null ? false : commentsDelta >= 0,
            },
          ] as const
        ).map((stat) => (
          <div key={stat.label} className="bg-card flex flex-col gap-1 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs">{stat.label}</span>

            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <strong className="text-2xl font-semibold tracking-tight">{stat.value}</strong>
            )}

            {statsLoading ? (
              <Skeleton className="h-3 w-28" />
            ) : (
              <small
                className={cn(
                  "text-xs",
                  stat.positive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {stat.note}
              </small>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <article className="bg-card flex min-h-80 flex-col gap-4 rounded-xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Performance</span>

              <h2 className="text-lg font-semibold">Channel overview</h2>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link to="/studio/analytics" />}
            >
              Analytics
              <ChevronRight data-icon="inline-end" className="size-3.5" />
            </Button>
          </div>

          <StudioMetricsChart
            className="min-h-56 flex-1 border-0 bg-transparent sm:p-0 shadow-none"
            series={chartSeries}
            granularity={analyticsMonth.data?.granularity ?? "day"}
            loading={chartLoading}
            emptyMessage="No engagement activity in this period"
          />
        </article>

        <aside className="bg-card flex flex-col gap-4 rounded-xl border p-5">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quick actions</span>

            <h2 className="text-lg font-semibold">Keep creating</h2>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-between px-4 py-3"
              nativeButton={false}
              render={<Link to="/studio/uploads/new" />}
            >
              <span className="flex min-w-0 items-start gap-3 text-left">
                <Upload className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">Upload a new video</span>
                  <span className="text-muted-foreground text-xs">Share something with your audience</span>
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-auto justify-between px-4 py-3"
              nativeButton={false}
              render={<Link to="/studio/uploads" />}
            >
              <span className="flex min-w-0 items-start gap-3 text-left">
                <FolderOpen className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">Manage your library</span>
                  <span className="text-muted-foreground text-xs">Browse all your uploaded videos</span>
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-auto justify-between px-4 py-3"
              nativeButton={false}
              render={<Link to="/studio/analytics/views" />}
            >
              <span className="flex min-w-0 items-start gap-3 text-left">
                <FileVideo className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">View performance</span>
                  <span className="text-muted-foreground text-xs">Open detailed studio analytics</span>
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            </Button>
          </div>
        </aside>
      </div>

      <section className="bg-card flex flex-col gap-4 rounded-xl border p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Your library</span>

            <h2 className="text-lg font-semibold">Recently uploaded</h2>
          </div>

          <Button type="button" variant="ghost" size="sm" nativeButton={false} render={<Link to="/studio/uploads" />}>
            View all
            <ChevronRight data-icon="inline-end" className="size-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-xs">
                <th className="pb-2 font-medium">Video</th>
                <th className="pb-2 font-medium">Size</th>
                <th className="pb-2 font-medium">Uploaded</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index} className="border-b border-border/50">
                      <td className="py-3">
                        <Skeleton className="h-4 w-48" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </td>
                    </tr>
                  ))
                : null}

              {!recentLoading && uploads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                    No uploads yet. Start by uploading your first video.
                  </td>
                </tr>
              ) : null}

              {!recentLoading
                ? uploads.map((item) => (
                    <tr key={item.public_id} className="border-b border-border/50 last:border-0">
                      <td className="py-3">
                        <Link
                          to="/studio/uploads/$uploadId"
                          params={{ uploadId: item.public_id }}
                          className="hover:text-primary flex min-w-0 items-center gap-3 transition-colors"
                        >
                          <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                            <FileVideo className="size-3.5 opacity-70" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-1 font-medium">{displayTitle(item)}</span>
                            <span className="text-muted-foreground block text-xs tabular-nums">{item.video_id}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-muted-foreground py-3 tabular-nums">
                        {item.source_bytes != null ? formatFileSize(item.source_bytes) : "—"}
                      </td>
                      <td className="text-muted-foreground py-3">{formatRelativeDate(item.created_at)}</td>
                      <td className="py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            statusClass(item.status),
                          )}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
