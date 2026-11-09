import { useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Heart, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getVideoUploadObservability, videoUploadObservabilityQueryKey } from "@/queries/video-upload";
import type {
  VideoUploadMetricPoint,
  VideoUploadMetricSeries,
  VideoUploadObservabilityResponse,
} from "@/queries/video-upload";
import { cn } from "@/libs/utils";

const DEFAULT_DAYS = 7;
const CHART_WIDTH = 720;
const CHART_HEIGHT = 280;
const CHART_PADDING_TOP = 12;
const CHART_PADDING_BOTTOM = 8;
const CHART_PADDING_LEFT = 40;
const CHART_PADDING_RIGHT = 12;

const METRICS = [
  {
    key: "views" as const,
    label: "Views",
    stroke: "#3b82f6",
    gradientFrom: "#3b82f6",
    icon: Eye,
  },
  {
    key: "likes" as const,
    label: "Likes",
    stroke: "#f43f5e",
    gradientFrom: "#f43f5e",
    icon: Heart,
  },
  {
    key: "comments" as const,
    label: "Comments",
    stroke: "#f59e0b",
    gradientFrom: "#f59e0b",
    icon: MessageCircle,
  },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

type StudioAnalyticsProps = {
  uploadId?: string;
  days?: number;
};

type PlottedPoint = {
  x: number;
  y: number;
  date: string;
  count: number;
};

type SeriesPlot = {
  key: MetricKey;
  label: string;
  stroke: string;
  gradientFrom: string;
  line: string;
  area: string;
  points: Array<PlottedPoint>;
  total: number;
};

type YTick = {
  value: number;
  y: number;
};

function formatDayLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);

  if (match == null) {
    return isoDate;
  }

  const month = Number(match[2]);
  const day = Number(match[3]);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${months[month - 1] ?? match[2]} ${String(day)}`;
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

function plotSeries(
  series: VideoUploadMetricSeries,
  key: MetricKey,
  label: string,
  stroke: string,
  gradientFrom: string,
  scaleMax: number,
  plotWidth: number,
  plotTop: number,
  plotBottom: number,
): SeriesPlot {
  const plotHeight = Math.max(plotBottom - plotTop, 1);
  const lastIndex = Math.max(series.points.length - 1, 1);
  const points = series.points.map((point, index) => {
    const x = CHART_PADDING_LEFT + (index / lastIndex) * plotWidth;
    const ratio = scaleMax > 0 ? point.count / scaleMax : 0;
    const y = plotBottom - ratio * plotHeight;

    return {
      x,
      y,
      date: point.date,
      count: point.count,
    };
  });
  const line = buildLinearPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  const area =
    points.length === 0
      ? ""
      : `${line} L ${last.x.toFixed(2)} ${plotBottom.toFixed(2)} L ${first.x.toFixed(2)} ${plotBottom.toFixed(2)} Z`;

  return {
    key,
    label,
    stroke,
    gradientFrom,
    line,
    area,
    points,
    total: series.total,
  };
}

function buildCombinedPlots(data: VideoUploadObservabilityResponse): {
  plots: Array<SeriesPlot>;
  yTicks: Array<YTick>;
  scaleMax: number;
} {
  const allPoints: Array<VideoUploadMetricPoint> = [
    ...data.views.points,
    ...data.likes.points,
    ...data.comments.points,
  ];
  const rawMax = Math.max(1, ...allPoints.map((point) => point.count));
  const scaleMax = niceMax(rawMax);
  const plotWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const plotTop = CHART_PADDING_TOP;
  const plotBottom = CHART_HEIGHT - CHART_PADDING_BOTTOM;
  const plots = METRICS.map((metric) =>
    plotSeries(
      data[metric.key],
      metric.key,
      metric.label,
      metric.stroke,
      metric.gradientFrom,
      scaleMax,
      plotWidth,
      plotTop,
      plotBottom,
    ),
  );
  const yTicks = buildYTicks(scaleMax, plotTop, plotBottom);

  return { plots, yTicks, scaleMax };
}

function findClosestDayIndex(referencePoints: Array<PlottedPoint>, pointerX: number): number | null {
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

function CombinedAnalyticsChart({
  data,
  loading,
}: {
  data: VideoUploadObservabilityResponse | null;
  loading: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartModel = useMemo(() => {
    if (data == null) {
      return {
        plots: [] as Array<SeriesPlot>,
        yTicks: [] as Array<YTick>,
        scaleMax: 1,
      };
    }

    return buildCombinedPlots(data);
  }, [data]);
  const { plots, yTicks } = chartModel;
  const referencePoints = plots[0]?.points ?? [];
  const activeDate =
    activeIndex == null || activeIndex >= referencePoints.length ? null : referencePoints[activeIndex].date;

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = plotRef.current;

    if (container == null || referencePoints.length === 0) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const ratioX = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
    const pointerX = ratioX * CHART_WIDTH;
    const nextIndex = findClosestDayIndex(referencePoints, pointerX);

    setActiveIndex(nextIndex);
  };

  const handlePointerLeave = () => {
    setActiveIndex(null);
  };

  const tooltipPlacement = useMemo(() => {
    if (activeIndex == null) {
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
      <div className="flex w-full flex-col gap-1">
        <div
          ref={plotRef}
          className="relative h-64 w-full sm:h-80"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <svg
            viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
            className="h-full w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Views, likes, and comments trend"
          >
            <defs>
              {plots.map((plot) => (
                <linearGradient
                  key={plot.key}
                  id={`analytics-fill-${gradientId}-${plot.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={plot.gradientFrom} stopOpacity={0.28} />

                  <stop offset="100%" stopColor={plot.gradientFrom} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>

            {yTicks.map((tick) => (
              <g key={`ytick-${String(tick.value)}`}>
                <line
                  x1={CHART_PADDING_LEFT}
                  y1={tick.y}
                  x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                  y2={tick.y}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}

            {plots.map((plot) => (
              <path key={`${plot.key}-area`} d={plot.area} fill={`url(#analytics-fill-${gradientId}-${plot.key})`} />
            ))}

            {plots.map((plot) => (
              <path
                key={`${plot.key}-line`}
                d={plot.line}
                fill="none"
                stroke={plot.stroke}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="pointer-events-none absolute inset-0">
            {yTicks.map((tick) => (
              <span
                key={`ylabel-${String(tick.value)}`}
                className="text-muted-foreground absolute -translate-y-1/2 text-[10px] tabular-nums"
                style={{
                  left: 0,
                  top: `${String((tick.y / CHART_HEIGHT) * 100)}%`,
                  width: `${String((CHART_PADDING_LEFT / CHART_WIDTH) * 100)}%`,
                  paddingRight: 6,
                  textAlign: "right",
                }}
              >
                {tick.value.toLocaleString()}
              </span>
            ))}
          </div>

          {activeIndex != null && activeDate != null && tooltipPlacement != null ? (
            <>
              {plots.map((plot) => {
                const point = plot.points[activeIndex];

                return (
                  <div
                    key={`marker-${plot.key}`}
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
                className="bg-background pointer-events-none absolute z-10 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs shadow-md"
                style={{
                  left: `${String(tooltipPlacement.leftPercent)}%`,
                  top: `${String(tooltipPlacement.topPercent)}%`,
                  transform: tooltipPlacement.transform,
                  marginLeft: tooltipPlacement.marginLeft,
                  marginTop: -12,
                }}
              >
                <div className="text-muted-foreground mb-1">{formatDayLabel(activeDate)}</div>

                <div className="flex flex-col gap-0.5">
                  {plots.map((plot) => {
                    const point = plot.points[activeIndex];

                    return (
                      <div key={`tip-${plot.key}`} className="flex items-center gap-2 tabular-nums">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: plot.stroke }}
                          aria-hidden
                        />

                        <span className="text-muted-foreground min-w-16">{plot.label}</span>

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

            const maxLabels = Math.min(referencePoints.length, 7);
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

                return (
                  <span
                    key={point.date}
                    className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${String(leftPercent)}%` }}
                  >
                    {formatDayLabel(point.date)}
                  </span>
                );
              });
          })()}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        {plots.map((plot) => (
          <div key={`legend-${plot.key}`} className="text-muted-foreground flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: plot.stroke }} aria-hidden />

            <span className="whitespace-nowrap">
              {plot.label}
              <span className="text-foreground ml-1 font-medium tabular-nums">{plot.total.toLocaleString()}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudioAnalytics({ uploadId, days = DEFAULT_DAYS }: StudioAnalyticsProps) {
  const resolvedUploadId = uploadId ?? "";
  const enabled = resolvedUploadId.length > 0;
  const query = useQuery({
    queryKey: videoUploadObservabilityQueryKey(resolvedUploadId, days),
    queryFn: () => getVideoUploadObservability(resolvedUploadId, days),
    enabled,
    staleTime: 30_000,
  });

  const data = query.data ?? null;
  const loading = enabled && query.isLoading && data == null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>

          <p className="text-muted-foreground text-sm">
            Combined views, likes, and comments
            {enabled ? ` over the last ${String(days)} days` : ""}
          </p>
        </div>

        {enabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            nativeButton={false}
            render={<Link to="/studio/uploads/$uploadId" params={{ uploadId: resolvedUploadId }} />}
          >
            <ArrowLeft data-icon="inline-start" className="size-4" />
            Back to upload
          </Button>
        ) : null}
      </div>

      {!enabled ? (
        <div className="bg-card flex flex-col items-start gap-3 rounded-xl border p-6">
          <p className="text-muted-foreground text-sm">
            Open analytics from an upload overview to inspect views, likes, and comments for that video.
          </p>

          <Button type="button" variant="secondary" nativeButton={false} render={<Link to="/studio/uploads" />}>
            Browse uploads
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {METRICS.map((metric) => {
              const series = data == null ? null : data[metric.key];
              const Icon = metric.icon;

              return (
                <div key={metric.key} className="bg-card flex items-center justify-between gap-3 rounded-xl border p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {metric.label}
                    </span>

                    {loading || series == null ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">
                        {series.total.toLocaleString()}
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
                </div>
              );
            })}
          </div>

          <CombinedAnalyticsChart data={data} loading={loading} />
        </div>
      )}
    </div>
  );
}

export function StudioAnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
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
