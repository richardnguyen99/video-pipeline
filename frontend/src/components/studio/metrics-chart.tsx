import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { ObservabilityGranularity } from "@/queries/video-upload";
import { cn } from "@/libs/utils";

export type StudioMetricsChartSeries = {
  key: string;
  label: string;
  color: string;
  points: Array<{ date: string; count: number }>;
  total: number;
};

type StudioMetricsChartProps = {
  series: Array<StudioMetricsChartSeries>;
  granularity: ObservabilityGranularity;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
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

function formatLegendLabel(label: string, total: number): string {
  const separator = " — ";
  const index = label.indexOf(separator);
  const code = index >= 0 ? label.slice(0, index).trim() : label.trim();

  return `${code} (${total.toLocaleString()})`;
}

function buildChartRows(
  series: Array<StudioMetricsChartSeries>,
  granularity: ObservabilityGranularity,
): Array<Record<string, string | number>> {
  const dates =
    series[0]?.points.map((point) => point.date) ??
    Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.date)))).sort();

  return dates.map((date) => {
    const row: Record<string, string | number> = {
      date,
      label: formatBucketLabel(date, granularity),
    };

    for (const item of series) {
      const match = item.points.find((point) => point.date === date);
      row[item.key] = match?.count ?? 0;
    }

    return row;
  });
}

export function StudioMetricsChart({
  series,
  granularity,
  loading = false,
  emptyMessage = "No analytics data available",
  className,
}: StudioMetricsChartProps) {
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};

    for (const item of series) {
      config[item.key] = {
        label: formatLegendLabel(item.label, item.total),
        color: item.color,
      };
    }

    return config;
  }, [series]);

  const data = useMemo(() => buildChartRows(series, granularity), [series, granularity]);

  if (loading) {
    return <Skeleton className={cn("h-80 w-full rounded-xl", className)} />;
  }

  if (series.length === 0 || data.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex h-80 items-center justify-center rounded-xl border border-dashed text-sm",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("bg-card flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border p-4 sm:p-5", className)}>
      <ChartContainer config={chartConfig} className="min-h-64 min-w-0 flex-1 aspect-auto h-full w-full">
        <LineChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} />

          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />

          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} allowDecimals={false} />

          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />

          <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />

          {series.map((item) => (
            <Line
              key={item.key}
              type="linear"
              dataKey={item.key}
              name={formatLegendLabel(item.label, item.total)}
              stroke={`var(--color-${item.key})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
