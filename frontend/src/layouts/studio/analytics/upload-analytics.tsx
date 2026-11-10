import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Eye, Heart, ListFilter, MessageCircle } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StudioMetricsChart } from "@/components/studio/metrics-chart";
import type { StudioMetricsChartSeries } from "@/components/studio/metrics-chart";
import { getVideoUploadObservability, videoUploadObservabilityQueryKey } from "@/queries/video-upload";
import type { ObservabilityRange, VideoUploadObservabilityResponse } from "@/queries/video-upload";
import { cn } from "@/libs/utils";

const METRICS = [
  {
    key: "views" as const,
    label: "Views",
    stroke: "#3b82f6",
    icon: Eye,
  },
  {
    key: "likes" as const,
    label: "Likes",
    stroke: "#f43f5e",
    icon: Heart,
  },
  {
    key: "comments" as const,
    label: "Comments",
    stroke: "#f59e0b",
    icon: MessageCircle,
  },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const RANGE_OPTIONS: Array<{ value: ObservabilityRange; label: string }> = [
  { value: "week", label: "1 week" },
  { value: "3months", label: "3 months" },
  { value: "year", label: "1 year" },
  { value: "all", label: "All time" },
];

type StudioAnalyticsProps = {
  uploadId: string;
};

function buildSeries(
  data: VideoUploadObservabilityResponse,
  enabledMetrics: ReadonlySet<MetricKey>,
): Array<StudioMetricsChartSeries> {
  return METRICS.filter((metric) => enabledMetrics.has(metric.key)).map((metric) => ({
    key: metric.key,
    label: metric.label,
    color: metric.stroke,
    points: data[metric.key].points,
    total: data[metric.key].total,
  }));
}

export function StudioAnalytics({ uploadId }: StudioAnalyticsProps) {
  const [range, setRange] = useState<ObservabilityRange>("week");
  const [enabledMetrics, setEnabledMetrics] = useState<Set<MetricKey>>(() => new Set(["views", "likes", "comments"]));
  const query = useQuery({
    queryKey: videoUploadObservabilityQueryKey(uploadId, { range }),
    queryFn: () => getVideoUploadObservability(uploadId, { range }),
    staleTime: 30_000,
  });

  const data = query.data ?? null;
  const loading = query.isLoading && data == null;

  const toggleMetric = (key: MetricKey) => {
    setEnabledMetrics((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        if (next.size === 1) {
          return current;
        }

        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const metricFilterLabel = (() => {
    if (enabledMetrics.size === METRICS.length) {
      return "All metrics";
    }

    const labels = METRICS.filter((metric) => enabledMetrics.has(metric.key)).map((metric) => metric.label);

    if (labels.length === 0) {
      return "Metrics";
    }

    return labels.join(", ");
  })();

  const series = data == null ? [] : buildSeries(data, enabledMetrics);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>

          <p className="text-muted-foreground text-sm">Combined views, likes, and comments</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Select
            value={range}
            items={RANGE_OPTIONS}
            onValueChange={(value) => {
              if (value == null) {
                return;
              }

              const match = RANGE_OPTIONS.find((option) => option.value === value);

              if (match != null) {
                setRange(match.value);
              }
            }}
          >
            <SelectTrigger className="w-35" size="sm" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>

            <SelectContent align="end">
              <SelectGroup>
                <SelectLabel>Date range</SelectLabel>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className={cn(
                "border-input bg-background hover:bg-muted inline-flex h-7 min-w-35 items-center justify-between gap-2 rounded-lg border px-2.5 text-sm shadow-xs transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
              aria-label="Filter metrics"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ListFilter className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{metricFilterLabel}</span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Metrics</DropdownMenuLabel>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                {METRICS.map((metric) => {
                  const active = enabledMetrics.has(metric.key);

                  return (
                    <DropdownMenuCheckboxItem
                      key={metric.key}
                      checked={active}
                      onCheckedChange={() => {
                        toggleMetric(metric.key);
                      }}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: metric.stroke }}
                        aria-hidden
                      />
                      {metric.label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {METRICS.map((metric) => {
            const seriesItem = data == null ? null : data[metric.key];
            const Icon = metric.icon;
            const active = enabledMetrics.has(metric.key);

            return (
              <button
                key={metric.key}
                type="button"
                data-slot="filter-tag"
                className={cn(
                  "bg-card flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-opacity",
                  !active && "opacity-50",
                )}
                aria-pressed={active}
                onClick={() => {
                  toggleMetric(metric.key);
                }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {metric.label}
                  </span>

                  {loading || seriesItem == null ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">
                      {seriesItem.total.toLocaleString()}
                    </span>
                  )}
                </div>

                <span
                  className={cn(
                    "rounded-md p-2",
                    metric.key === "views" && "bg-blue-500/15 text-blue-500",
                    metric.key === "likes" && "bg-rose-500/15 text-rose-500",
                    metric.key === "comments" && "bg-amber-500/15 text-amber-500",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
              </button>
            );
          })}
        </div>

        <StudioMetricsChart
          series={series}
          granularity={data?.granularity ?? "day"}
          loading={loading}
          emptyMessage={
            enabledMetrics.size === 0
              ? "Select at least one metric to display the chart"
              : "No analytics data available"
          }
        />
      </div>
    </div>
  );
}

export function StudioAnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>

      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
