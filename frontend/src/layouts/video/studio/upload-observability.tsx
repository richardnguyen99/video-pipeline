import { useMemo } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Eye, Heart, MessageCircle } from "lucide-react";
import { Area, AreaChart, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { getVideoUploadObservability, videoUploadObservabilityQueryKey } from "@/queries/video-upload";
import type { VideoUploadMetricSeries } from "@/queries/video-upload";
import { cn } from "@/libs/utils";

const DEFAULT_DAYS = 7;

type UploadObservabilityProps = {
  uploadId: string;
  days?: number;
};

type MetricCardProps = {
  title: string;
  series: VideoUploadMetricSeries | null;
  accentClassName: string;
  stroke: string;
  metricKey: string;
  icon: ReactNode;
  loading?: boolean;
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

function MetricCard({ title, series, accentClassName, stroke, metricKey, icon, loading = false }: MetricCardProps) {
  const chartConfig = useMemo(
    () =>
      ({
        [metricKey]: {
          label: title,
          color: stroke,
        },
      }) satisfies ChartConfig,
    [metricKey, stroke, title],
  );

  const chartData = useMemo(() => {
    if (series == null) {
      return [];
    }

    return series.points.map((point) => ({
      date: point.date,
      label: formatDayLabel(point.date),
      [metricKey]: point.count,
    }));
  }, [metricKey, series]);

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

      <div className="mt-auto h-20 w-full">
        {loading || series == null ? (
          <Skeleton className="h-full w-full rounded-md" />
        ) : chartData.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">No data</div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-full w-full overflow-visible [&_.recharts-surface]:overflow-visible"
            initialDimension={{ width: 240, height: 80 }}
          >
            <AreaChart accessibilityLayer data={chartData} margin={{ top: 8, right: 6, left: 6, bottom: 8 }}>
              <defs>
                <linearGradient id={`fill-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${metricKey})`} stopOpacity={0.35} />

                  <stop offset="100%" stopColor={`var(--color-${metricKey})`} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <YAxis domain={[0, "auto"]} hide width={0} />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(_value, payload) => {
                      const point = payload[0]?.payload as { label?: string } | undefined;

                      return point?.label ?? "";
                    }}
                  />
                }
              />

              <Area
                type="linear"
                dataKey={metricKey}
                stroke={`var(--color-${metricKey})`}
                fill={`url(#fill-${metricKey})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ChartContainer>
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
          metricKey="views"
          icon={<Eye className="size-4" aria-hidden />}
        />

        <MetricCard
          title="Likes"
          series={data?.likes ?? null}
          loading={loading}
          accentClassName="bg-rose-500/15 text-rose-500"
          stroke="#f43f5e"
          metricKey="likes"
          icon={<Heart className="size-4" aria-hidden />}
        />

        <MetricCard
          title="Comments"
          series={data?.comments ?? null}
          loading={loading}
          accentClassName="bg-amber-500/15 text-amber-500"
          stroke="#f59e0b"
          metricKey="comments"
          icon={<MessageCircle className="size-4" aria-hidden />}
        />
      </div>
    </section>
  );
}
