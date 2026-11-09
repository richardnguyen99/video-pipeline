import { useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Heart, MessageCircle } from "lucide-react";

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
  strokeClassName: string;
  fillClassName: string;
  icon: ReactNode;
  loading?: boolean;
};

function buildAreaPath(
  points: Array<{ count: number }>,
  width: number,
  height: number,
): { line: string; area: string } {
  if (points.length === 0) {
    return { line: "", area: "" };
  }

  const max = Math.max(1, ...points.map((point) => point.count));
  const stepX = points.length > 1 ? width / (points.length - 1) : width;

  const coords = points.map((point, index) => {
    const x = index * stepX;
    const y = height - (point.count / max) * (height - 4) - 2;

    return { x, y };
  });

  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const area = `${line} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`;

  return { line, area };
}

function MetricCard({
  title,
  series,
  accentClassName,
  strokeClassName,
  fillClassName,
  icon,
  loading = false,
}: MetricCardProps) {
  const chart = useMemo(() => {
    if (series == null) {
      return { line: "", area: "" };
    }

    return buildAreaPath(series.points, 240, 72);
  }, [series]);

  return (
    <div className="bg-card flex min-h-36 flex-col gap-3 rounded-xl border p-4">
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

      <div className="mt-auto h-18 w-full">
        {loading || series == null ? (
          <Skeleton className="h-full w-full rounded-md" />
        ) : (
          <svg
            viewBox="0 0 240 72"
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title} trend`}
          >
            <path d={chart.area} className={cn(fillClassName, "opacity-30")} />

            <path
              d={chart.line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={strokeClassName}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

export function UploadObservability({ uploadId, days = DEFAULT_DAYS }: UploadObservabilityProps) {
  const query = useQuery({
    queryKey: videoUploadObservabilityQueryKey(uploadId, days),
    queryFn: () => getVideoUploadObservability(uploadId, days),
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
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          title="Views"
          series={data?.views ?? null}
          loading={loading}
          accentClassName="bg-blue-500/15 text-blue-500"
          strokeClassName="text-blue-500"
          fillClassName="fill-blue-500"
          icon={<Eye className="size-4" aria-hidden />}
        />

        <MetricCard
          title="Likes"
          series={data?.likes ?? null}
          loading={loading}
          accentClassName="bg-rose-500/15 text-rose-500"
          strokeClassName="text-rose-500"
          fillClassName="fill-rose-500"
          icon={<Heart className="size-4" aria-hidden />}
        />

        <MetricCard
          title="Comments"
          series={data?.comments ?? null}
          loading={loading}
          accentClassName="bg-amber-500/15 text-amber-500"
          strokeClassName="text-amber-500"
          fillClassName="fill-amber-500"
          icon={<MessageCircle className="size-4" aria-hidden />}
        />
      </div>
    </section>
  );
}
