import { useMemo, useState } from "react";
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
import { getStudioAnalytics, studioAnalyticsQueryKey } from "@/queries/video-upload";
import type {
  ObservabilityRange,
  StudioAnalyticsLine,
  StudioAnalyticsMetric,
  StudioAnalyticsResponse,
} from "@/queries/video-upload";
import { cn } from "@/libs/utils";

const RANGE_OPTIONS: Array<{ value: ObservabilityRange; label: string }> = [
  { value: "week", label: "1 week" },
  { value: "3months", label: "3 months" },
  { value: "year", label: "1 year" },
  { value: "all", label: "All time" },
];

const METRIC_STROKES: Record<string, string> = {
  views: "#3b82f6",
  likes: "#f43f5e",
  comments: "#f59e0b",
  aggregate: "#a78bfa",
};

const UPLOAD_PALETTE = [
  "#38bdf8",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#a3e635",
  "#e879f9",
  "#22d3ee",
  "#fbbf24",
  "#c084fc",
  "#4ade80",
];

const METRIC_FILTER_OPTIONS = [
  { key: "views" as const, label: "Views", stroke: "#3b82f6" },
  { key: "likes" as const, label: "Likes", stroke: "#f43f5e" },
  { key: "comments" as const, label: "Comments", stroke: "#f59e0b" },
];

type MetricFilterKey = (typeof METRIC_FILTER_OPTIONS)[number]["key"];

const PAGE_COPY: Record<StudioAnalyticsMetric, { title: string; description: string }> = {
  overall: {
    title: "Overall",
    description: "Accumulated views, likes, and comments across all uploads",
  },
  views: {
    title: "Views",
    description: "View counts across all uploads",
  },
  likes: {
    title: "Likes",
    description: "Like counts across all uploads",
  },
  comments: {
    title: "Comments",
    description: "Comment counts across all uploads",
  },
};

function strokeForLine(line: StudioAnalyticsLine, uploadIndex: number): string {
  if (line.kind === "metric" || line.kind === "aggregate") {
    return METRIC_STROKES[line.id] ?? METRIC_STROKES.aggregate;
  }

  return UPLOAD_PALETTE[uploadIndex % UPLOAD_PALETTE.length];
}

function buildSeries(
  data: StudioAnalyticsResponse,
  showUploads: boolean,
  enabledMetrics: ReadonlySet<string>,
): Array<StudioMetricsChartSeries> {
  let uploadIndex = 0;
  const visible = data.lines.filter((line) => {
    if (line.kind === "upload") {
      return showUploads;
    }

    if (line.kind === "metric") {
      return enabledMetrics.has(line.id);
    }

    return true;
  });

  return visible.map((line) => {
    const color = strokeForLine(line, uploadIndex);

    if (line.kind === "upload") {
      uploadIndex += 1;
    }

    return {
      key: line.id,
      label: line.label,
      color,
      points: line.points,
      total: line.total,
    };
  });
}

export function StudioOverallAnalytics({ metric }: { metric: StudioAnalyticsMetric }) {
  const [range, setRange] = useState<ObservabilityRange>("week");
  const [showUploads, setShowUploads] = useState(true);
  const [enabledMetrics, setEnabledMetrics] = useState<Set<MetricFilterKey>>(
    () => new Set(["views", "likes", "comments"]),
  );
  const query = useQuery({
    queryKey: studioAnalyticsQueryKey(metric, range),
    queryFn: () => getStudioAnalytics(metric, range),
    staleTime: 30_000,
  });
  const data = query.data ?? null;
  const loading = query.isLoading && data == null;
  const copy = PAGE_COPY[metric];
  const supportsUploads = metric !== "overall";
  const supportsMetricFilter = metric === "overall";
  const summaryLines =
    data == null
      ? []
      : data.lines.filter((line) => (metric === "overall" ? line.kind === "metric" : line.kind === "aggregate"));

  const toggleMetric = (key: MetricFilterKey) => {
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
    if (enabledMetrics.size === METRIC_FILTER_OPTIONS.length) {
      return "All metrics";
    }

    const labels = METRIC_FILTER_OPTIONS.filter((item) => enabledMetrics.has(item.key)).map((item) => item.label);

    if (labels.length === 0) {
      return "Metrics";
    }

    return labels.join(", ");
  })();

  const series = useMemo(() => {
    if (data == null) {
      return [];
    }

    return buildSeries(data, supportsUploads && showUploads, enabledMetrics);
  }, [data, enabledMetrics, showUploads, supportsUploads]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>

          <p className="text-muted-foreground text-sm">{copy.description}</p>
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

          {supportsMetricFilter ? (
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
                  {METRIC_FILTER_OPTIONS.map((item) => {
                    const active = enabledMetrics.has(item.key);

                    return (
                      <DropdownMenuCheckboxItem
                        key={item.key}
                        checked={active}
                        onCheckedChange={() => {
                          toggleMetric(item.key);
                        }}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: item.stroke }}
                          aria-hidden
                        />
                        {item.label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {supportsUploads ? (
            <button
              type="button"
              data-slot="filter-tag"
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
                showUploads ? "bg-muted text-foreground border-border" : "text-muted-foreground hover:bg-muted/60",
              )}
              aria-pressed={showUploads}
              onClick={() => {
                setShowUploads((value) => !value);
              }}
            >
              Individual uploads
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(metric === "overall"
          ? [
              { key: "views", label: "Views", icon: Eye },
              { key: "likes", label: "Likes", icon: Heart },
              { key: "comments", label: "Comments", icon: MessageCircle },
            ]
          : [
              {
                key: metric,
                label: copy.title,
                icon: metric === "views" ? Eye : metric === "likes" ? Heart : MessageCircle,
              },
            ]
        ).map((card) => {
          const matched = summaryLines.find((item) => item.id === card.key);
          const line = matched ?? (summaryLines.length > 0 ? summaryLines[0] : undefined);
          const Icon = card.icon;
          const showSkeleton = loading || line === undefined;
          const filterKey = card.key === "views" || card.key === "likes" || card.key === "comments" ? card.key : null;
          const active = filterKey == null || !supportsMetricFilter ? true : enabledMetrics.has(filterKey);

          if (supportsMetricFilter && filterKey != null) {
            return (
              <button
                key={card.key}
                type="button"
                data-slot="filter-tag"
                className={cn(
                  "bg-card flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-opacity",
                  !active && "opacity-50",
                )}
                aria-pressed={active}
                onClick={() => {
                  toggleMetric(filterKey);
                }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {card.label}
                  </span>

                  {showSkeleton ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">
                      {line.total.toLocaleString()}
                    </span>
                  )}
                </div>

                <span
                  className={cn(
                    "rounded-md p-2",
                    card.key === "views" && "bg-blue-500/15 text-blue-500",
                    card.key === "likes" && "bg-rose-500/15 text-rose-500",
                    card.key === "comments" && "bg-amber-500/15 text-amber-500",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
              </button>
            );
          }

          return (
            <div key={card.key} className="bg-card flex items-center justify-between gap-3 rounded-xl border p-4">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{card.label}</span>

                {showSkeleton ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {line.total.toLocaleString()}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "rounded-md p-2",
                  card.key === "views" && "bg-blue-500/15 text-blue-500",
                  card.key === "likes" && "bg-rose-500/15 text-rose-500",
                  card.key === "comments" && "bg-amber-500/15 text-amber-500",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
            </div>
          );
        })}
      </div>

      <StudioMetricsChart
        series={series}
        granularity={data?.granularity ?? "day"}
        loading={loading}
        emptyMessage={
          supportsMetricFilter && enabledMetrics.size === 0
            ? "Select at least one metric to display the chart"
            : "No analytics data available"
        }
      />
    </div>
  );
}

export function StudioOverallAnalyticsSkeleton() {
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
