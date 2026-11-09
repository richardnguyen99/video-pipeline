import { useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Eye, Heart, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getVideoUploadObservability, videoUploadObservabilityQueryKey } from "@/queries/video-upload";
import type { VideoUploadMetricPoint, VideoUploadMetricSeries } from "@/queries/video-upload";
import { cn } from "@/libs/utils";

const DEFAULT_DAYS = 7;
const CHART_WIDTH = 240;
const CHART_HEIGHT = 72;

type UploadObservabilityProps = {
  uploadId: string;
  days?: number;
};

type MetricCardProps = {
  title: string;
  series: VideoUploadMetricSeries | null;
  accentClassName: string;
  stroke: string;
  gradientFrom: string;
  icon: ReactNode;
  loading?: boolean;
};

type PlottedPoint = {
  x: number;
  y: number;
  date: string;
  count: number;
};

type ChartGeometry = {
  line: string;
  area: string;
  points: Array<PlottedPoint>;
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

function buildChartGeometry(points: Array<VideoUploadMetricPoint>, width: number, height: number): ChartGeometry {
  if (points.length === 0) {
    return { line: "", area: "", points: [] };
  }

  const max = Math.max(1, ...points.map((point) => point.count));
  const lastIndex = Math.max(points.length - 1, 1);
  const plotted = points.map((point, index) => {
    const x = (index / lastIndex) * width;
    const y = height - (point.count / max) * (height - 8) - 4;

    return {
      x,
      y,
      date: point.date,
      count: point.count,
    };
  });
  const line = buildLinearPath(plotted);
  const first = plotted[0];
  const last = plotted[plotted.length - 1];
  const area = `${line} L ${last.x.toFixed(2)} ${height.toFixed(2)} L ${first.x.toFixed(2)} ${height.toFixed(2)} Z`;

  return { line, area, points: plotted };
}

function findClosestPointIndex(points: Array<PlottedPoint>, pointerX: number): number | null {
  if (points.length === 0) {
    return null;
  }

  let closestIndex = 0;
  let closestDistance = Math.abs(points[0].x - pointerX);

  for (let index = 1; index < points.length; index += 1) {
    const distance = Math.abs(points[index].x - pointerX);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

function MetricCard({ title, series, accentClassName, stroke, gradientFrom, icon, loading = false }: MetricCardProps) {
  const gradientId = useId().replace(/:/g, "");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chart = useMemo(() => {
    if (series == null) {
      return { line: "", area: "", points: [] as Array<PlottedPoint> };
    }

    return buildChartGeometry(series.points, CHART_WIDTH, CHART_HEIGHT);
  }, [series]);
  const activePoint = activeIndex == null ? null : (chart.points[activeIndex] ?? null);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = chartRef.current;

    if (container == null || chart.points.length === 0) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const ratioX = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
    const pointerX = ratioX * CHART_WIDTH;
    const nextIndex = findClosestPointIndex(chart.points, pointerX);

    setActiveIndex(nextIndex);
  };

  const handlePointerLeave = () => {
    setActiveIndex(null);
  };

  const tooltipPlacement = useMemo(() => {
    if (activePoint == null) {
      return null;
    }

    const leftPercent = (activePoint.x / CHART_WIDTH) * 100;
    const topPercent = (activePoint.y / CHART_HEIGHT) * 100;
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
  }, [activePoint]);

  return (
    <div className="bg-card flex min-h-40 flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</span>

          {loading || series == null ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{series.total.toLocaleString()}</span>
          )}
        </div>

        <span className={cn("rounded-md p-2", accentClassName)}>{icon}</span>
      </div>

      <div
        ref={chartRef}
        className="relative mt-auto h-20 w-full"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {loading || series == null ? (
          <Skeleton className="h-full w-full rounded-md" />
        ) : (
          <>
            <svg
              viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
              className="h-full w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${title} trend`}
            >
              <defs>
                <linearGradient id={`metric-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradientFrom} stopOpacity={0.35} />

                  <stop offset="100%" stopColor={gradientFrom} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <path d={chart.area} fill={`url(#metric-fill-${gradientId})`} />

              <path
                d={chart.line}
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {activePoint != null && tooltipPlacement != null ? (
              <>
                <div
                  className="pointer-events-none absolute size-2.5 rounded-full border-2 bg-card"
                  style={{
                    left: `${String(tooltipPlacement.leftPercent)}%`,
                    top: `${String(tooltipPlacement.topPercent)}%`,
                    borderColor: stroke,
                    transform: "translate(-50%, -50%)",
                  }}
                />

                <div
                  className="bg-background pointer-events-none absolute z-10 whitespace-nowrap rounded-md border px-2 py-1 text-xs shadow-md"
                  style={{
                    left: `${String(tooltipPlacement.leftPercent)}%`,
                    top: `${String(tooltipPlacement.topPercent)}%`,
                    transform: tooltipPlacement.transform,
                    marginLeft: tooltipPlacement.marginLeft,
                    marginTop: -10,
                  }}
                >
                  <div className="text-muted-foreground">{formatDayLabel(activePoint.date)}</div>

                  <div className="font-medium tabular-nums">
                    {activePoint.count.toLocaleString()} {title.toLowerCase()}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stroke }} aria-hidden />

        <span className="whitespace-nowrap">
          {title}
          {series != null ? ` · ${String(series.points.length)} days` : ""}
        </span>
      </div>
    </div>
  );
}

export function UploadObservability({ uploadId, days = DEFAULT_DAYS }: UploadObservabilityProps) {
  const query = useQuery({
    queryKey: videoUploadObservabilityQueryKey(uploadId, { days }),
    queryFn: () => getVideoUploadObservability(uploadId, { days }),
    staleTime: 30_000,
  });

  const data = query.data;
  const loading = query.isLoading && data == null;

  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Observability</h2>

          <p className="text-muted-foreground text-xs">Views, likes, and comments over the last {String(days)} days</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          nativeButton={false}
          render={<Link to="/studio/uploads/$uploadId/analytics" params={{ uploadId }} />}
        >
          Analytics
          <ArrowUpRight data-icon="inline-end" className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          title="Views"
          series={data?.views ?? null}
          loading={loading}
          accentClassName="bg-blue-500/15 text-blue-500"
          stroke="#3b82f6"
          gradientFrom="#3b82f6"
          icon={<Eye className="size-4" aria-hidden />}
        />

        <MetricCard
          title="Likes"
          series={data?.likes ?? null}
          loading={loading}
          accentClassName="bg-rose-500/15 text-rose-500"
          stroke="#f43f5e"
          gradientFrom="#f43f5e"
          icon={<Heart className="size-4" aria-hidden />}
        />

        <MetricCard
          title="Comments"
          series={data?.comments ?? null}
          loading={loading}
          accentClassName="bg-amber-500/15 text-amber-500"
          stroke="#f59e0b"
          gradientFrom="#f59e0b"
          icon={<MessageCircle className="size-4" aria-hidden />}
        />
      </div>
    </section>
  );
}
