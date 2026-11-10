import { useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Heart, MessageCircle } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getStudioAnalytics, studioAnalyticsQueryKey } from "@/queries/video-upload";
import type {
  ObservabilityGranularity,
  ObservabilityRange,
  StudioAnalyticsLine,
  StudioAnalyticsMetric,
  StudioAnalyticsResponse,
} from "@/queries/video-upload";
import { cn } from "@/libs/utils";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 280;
const CHART_PADDING_TOP = 12;
const CHART_PADDING_BOTTOM = 8;

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

type PlottedPoint = {
  x: number;
  y: number;
  date: string;
  count: number;
  label: string;
};

type SeriesPlot = {
  id: string;
  label: string;
  stroke: string;
  line: string;
  points: Array<PlottedPoint>;
  total: number;
  kind: StudioAnalyticsLine["kind"];
};

type YTick = {
  value: number;
  y: number;
};

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (match == null) {
    return new Date(value);
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatBucketLabel(isoDate: string, granularity: ObservabilityGranularity): string {
  const date = parseIsoDate(isoDate);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getUTCMonth()] ?? "";
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();

  if (granularity === "month") {
    return `${month} ${String(year)}`;
  }

  if (granularity === "week") {
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 6);
    const endMonth = months[end.getUTCMonth()] ?? "";
    const endDay = end.getUTCDate();

    if (date.getUTCMonth() === end.getUTCMonth()) {
      return `${month} ${String(day)}–${String(endDay)}`;
    }

    return `${month} ${String(day)} – ${endMonth} ${String(endDay)}`;
  }

  return `${month} ${String(day)}`;
}

function buildLinearPath(points: Array<PlottedPoint>): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";

      return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function niceMax(value: number): number {
  if (value <= 1) {
    return 1;
  }

  if (value <= 2) {
    return 2;
  }

  if (value <= 4) {
    return 4;
  }

  if (value <= 5) {
    return 5;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }

  if (normalized <= 2) {
    return 2 * magnitude;
  }

  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

function buildYTicks(maxCount: number, plotTop: number, plotBottom: number): Array<YTick> {
  const scaleMax = niceMax(maxCount);
  const plotHeight = Math.max(plotBottom - plotTop, 1);
  const preferredSteps = scaleMax <= 4 ? scaleMax : 4;
  const step = Math.max(1, Math.ceil(scaleMax / preferredSteps));
  const ticks: Array<YTick> = [];

  for (let value = 0; value <= scaleMax; value += step) {
    const ratio = scaleMax > 0 ? value / scaleMax : 0;
    const y = plotBottom - ratio * plotHeight;

    ticks.push({ value, y });
  }

  const lastTick = ticks.at(-1);

  if (lastTick == null || lastTick.value !== scaleMax) {
    ticks.push({ value: scaleMax, y: plotTop });
  }

  return ticks;
}

function strokeForLine(line: StudioAnalyticsLine, uploadIndex: number): string {
  if (line.kind === "metric" || line.kind === "aggregate") {
    return METRIC_STROKES[line.id] ?? METRIC_STROKES.aggregate;
  }

  return UPLOAD_PALETTE[uploadIndex % UPLOAD_PALETTE.length];
}

function buildPlots(
  data: StudioAnalyticsResponse,
  showUploads: boolean,
): { plots: Array<SeriesPlot>; yTicks: Array<YTick> } {
  const visible = data.lines.filter((line) => {
    if (line.kind === "upload") {
      return showUploads;
    }

    return true;
  });
  const rawMax = Math.max(1, ...visible.flatMap((line) => line.points.map((point) => point.count)), 0);
  const scaleMax = niceMax(rawMax);
  const plotTop = CHART_PADDING_TOP;
  const plotBottom = CHART_HEIGHT - CHART_PADDING_BOTTOM;
  const plotHeight = Math.max(plotBottom - plotTop, 1);
  let uploadIndex = 0;
  const plots = visible.map((line) => {
    const stroke = strokeForLine(line, uploadIndex);

    if (line.kind === "upload") {
      uploadIndex += 1;
    }

    const lastIndex = Math.max(line.points.length - 1, 1);
    const points = line.points.map((point, index) => {
      const x = (index / lastIndex) * CHART_WIDTH;
      const ratio = scaleMax > 0 ? point.count / scaleMax : 0;
      const y = plotBottom - ratio * plotHeight;

      return {
        x,
        y,
        date: point.date,
        count: point.count,
        label: formatBucketLabel(point.date, data.granularity),
      };
    });

    return {
      id: line.id,
      label: line.label,
      stroke,
      line: buildLinearPath(points),
      points,
      total: line.total,
      kind: line.kind,
    };
  });

  return {
    plots,
    yTicks: buildYTicks(scaleMax, plotTop, plotBottom),
  };
}

function findClosestIndex(referencePoints: Array<PlottedPoint>, pointerX: number): number | null {
  if (referencePoints.length === 0) {
    return null;
  }

  let closestIndex = 0;
  let closestDistance = Math.abs(referencePoints[0].x - pointerX);

  for (let index = 1; index < referencePoints.length; index += 1) {
    const distance = Math.abs(referencePoints[index].x - pointerX);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

function OverallAnalyticsChart({
  data,
  loading,
  showUploads,
}: {
  data: StudioAnalyticsResponse | null;
  loading: boolean;
  showUploads: boolean;
}) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartModel = useMemo(() => {
    if (data == null) {
      return { plots: [] as Array<SeriesPlot>, yTicks: [] as Array<YTick> };
    }

    return buildPlots(data, showUploads);
  }, [data, showUploads]);
  const { plots, yTicks } = chartModel;
  const referencePoints = plots[0]?.points ?? [];
  const activePoint =
    activeIndex == null || activeIndex >= referencePoints.length ? null : referencePoints[activeIndex];

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = plotRef.current;

    if (container == null || referencePoints.length === 0) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const ratioX = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
    const nextIndex = findClosestIndex(referencePoints, ratioX * CHART_WIDTH);

    setActiveIndex(nextIndex);
  };

  const tooltipPlacement = useMemo(() => {
    if (activeIndex == null || plots.length === 0) {
      return null;
    }

    const activePoints = plots.map((plot) => plot.points[activeIndex]);
    const anchor = activePoints.reduce((best, point) => (point.y < best.y ? point : best));
    const leftPercent = (anchor.x / CHART_WIDTH) * 100;
    const topPercent = (anchor.y / CHART_HEIGHT) * 100;
    const alignNearRight = leftPercent > 72;
    const alignNearLeft = leftPercent < 18;

    return {
      leftPercent,
      topPercent,
      transform: alignNearRight
        ? "translate(-100%, -100%)"
        : alignNearLeft
          ? "translate(0, -100%)"
          : "translate(-50%, -100%)",
      marginLeft: alignNearRight ? -4 : alignNearLeft ? 4 : 0,
    };
  }, [activeIndex, plots]);

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  if (data == null || plots.length === 0) {
    return (
      <div className="text-muted-foreground flex h-80 items-center justify-center rounded-xl border border-dashed text-sm">
        No analytics data available
      </div>
    );
  }

  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <div className="flex w-full gap-2">
        <div className="relative h-64 w-8 shrink-0 sm:h-80">
          {yTicks.map((tick) => (
            <span
              key={`ylabel-${String(tick.value)}`}
              className="text-muted-foreground absolute right-0 -translate-y-1/2 pr-1 text-[10px] tabular-nums"
              style={{ top: `${String((tick.y / CHART_HEIGHT) * 100)}%` }}
            >
              {tick.value.toLocaleString()}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div
            ref={plotRef}
            className="relative h-64 w-full sm:h-80"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => {
              setActiveIndex(null);
            }}
          >
            <svg
              viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
              className="h-full w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label="Studio analytics trend"
            >
              <defs>
                <clipPath id={`plot-clip-${gradientId}`}>
                  <rect x="0" y="0" width={CHART_WIDTH} height={CHART_HEIGHT} />
                </clipPath>
              </defs>

              {yTicks.map((tick) => (
                <line
                  key={`ygrid-${String(tick.value)}`}
                  x1={0}
                  y1={tick.y}
                  x2={CHART_WIDTH}
                  y2={tick.y}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {plots.map((plot) => (
                <path
                  key={`${plot.id}-line`}
                  d={plot.line}
                  fill="none"
                  stroke={plot.stroke}
                  strokeWidth={plot.kind === "aggregate" ? "2.75" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={plot.kind === "upload" ? 0.85 : 1}
                />
              ))}
            </svg>

            {activeIndex != null && activePoint != null && tooltipPlacement != null ? (
              <>
                {plots.map((plot) => {
                  const point = plot.points[activeIndex];

                  return (
                    <div
                      key={`marker-${plot.id}`}
                      className="pointer-events-none absolute size-2.5 rounded-full border-2 bg-card"
                      style={{
                        left: `${String((point.x / CHART_WIDTH) * 100)}%`,
                        top: `${String((point.y / CHART_HEIGHT) * 100)}%`,
                        borderColor: plot.stroke,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  );
                })}

                <div
                  className="bg-background pointer-events-none absolute z-10 max-w-xs rounded-md border px-2.5 py-1.5 text-xs shadow-md"
                  style={{
                    left: `${String(tooltipPlacement.leftPercent)}%`,
                    top: `${String(tooltipPlacement.topPercent)}%`,
                    transform: tooltipPlacement.transform,
                    marginLeft: tooltipPlacement.marginLeft,
                    marginTop: -12,
                  }}
                >
                  <div className="text-muted-foreground mb-1 whitespace-nowrap">{activePoint.label}</div>

                  <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                    {plots.map((plot) => {
                      const point = plot.points[activeIndex];

                      return (
                        <div key={`tip-${plot.id}`} className="flex items-center gap-2 tabular-nums">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: plot.stroke }}
                            aria-hidden
                          />

                          <span className="text-muted-foreground min-w-0 flex-1 truncate">{plot.label}</span>

                          <span className="font-medium">{point.count.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="text-muted-foreground relative h-4 w-full text-[10px]">
            {(() => {
              if (referencePoints.length === 0) {
                return null;
              }

              const maxLabels = Math.min(referencePoints.length, 8);
              const step = Math.max(1, Math.floor((referencePoints.length - 1) / Math.max(maxLabels - 1, 1)));
              const indices = new Set<number>();

              for (let index = 0; index < referencePoints.length; index += step) {
                indices.add(index);
              }

              indices.add(referencePoints.length - 1);

              return Array.from(indices)
                .sort((a, b) => a - b)
                .map((index) => {
                  const point = referencePoints[index];
                  const leftPercent = (point.x / CHART_WIDTH) * 100;
                  const isFirst = index === 0;
                  const isLast = index === referencePoints.length - 1;

                  return (
                    <span
                      key={point.date}
                      className="absolute whitespace-nowrap"
                      style={{
                        left: `${String(leftPercent)}%`,
                        transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                      }}
                    >
                      {point.label}
                    </span>
                  );
                });
            })()}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {plots.map((plot) => (
          <div key={`legend-${plot.id}`} className="text-muted-foreground flex max-w-full items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: plot.stroke }} aria-hidden />

            <span className="truncate whitespace-nowrap">
              {plot.label}
              <span className="text-foreground ml-1 font-medium tabular-nums">{plot.total.toLocaleString()}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

export function StudioOverallAnalytics({ metric }: { metric: StudioAnalyticsMetric }) {
  const [range, setRange] = useState<ObservabilityRange>("week");
  const [showUploads, setShowUploads] = useState(true);
  const query = useQuery({
    queryKey: studioAnalyticsQueryKey(metric, range),
    queryFn: () => getStudioAnalytics(metric, range),
    staleTime: 30_000,
  });
  const data = query.data ?? null;
  const loading = query.isLoading && data == null;
  const copy = PAGE_COPY[metric];
  const supportsUploads = metric !== "overall";
  const summaryLines =
    data == null
      ? []
      : data.lines.filter((line) => (metric === "overall" ? line.kind === "metric" : line.kind === "aggregate"));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>

          <p className="text-muted-foreground text-sm">{copy.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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

          <Select
            value={range}
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
            <SelectTrigger className="w-[140px]" size="sm" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>

            <SelectContent align="end">
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <OverallAnalyticsChart data={data} loading={loading} showUploads={supportsUploads && showUploads} />
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
