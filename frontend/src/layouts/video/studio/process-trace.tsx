import { CheckIcon, CircleIcon, LoaderCircleIcon, RotateCcwIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { VideoRenditionProgress, VideoUploadStatusResponse } from "@/queries/video-upload";

function traceStatusFor(status: string): "running" | "error" | "pending" | undefined {
  const normalized = status.toUpperCase();

  if (normalized === "ENCODING" || normalized === "PENDING") {
    return normalized === "PENDING" ? "pending" : "running";
  }

  if (normalized === "FAILED") {
    return "error";
  }

  if (normalized === "READY") {
    return undefined;
  }

  return "pending";
}

function StatusIcon({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  if (normalized === "READY") {
    return <CheckIcon className="text-emerald-500" />;
  }

  if (normalized === "FAILED") {
    return <XIcon className="text-destructive" />;
  }

  if (normalized === "ENCODING") {
    return <LoaderCircleIcon className="animate-spin" />;
  }

  return <CircleIcon className="opacity-50" />;
}

function descriptionFor(row: VideoRenditionProgress): string {
  const normalized = row.status.toUpperCase();

  if (normalized === "READY") {
    const segments = row.segment_count != null && row.segment_count > 0 ? ` · ${row.segment_count} segments` : "";

    return `Complete${segments}`;
  }

  if (normalized === "FAILED") {
    return "Failed";
  }

  if (normalized === "ENCODING") {
    const segments = row.segment_count != null && row.segment_count > 0 ? ` · ${row.segment_count} seg` : "";

    return `${row.progress_pct}%${segments}`;
  }

  return "Queued";
}

function isRecoverable(row: VideoRenditionProgress): boolean {
  const normalized = row.status.toUpperCase();

  return normalized === "FAILED" || normalized === "ENCODING" || normalized === "PENDING";
}

function overallFromRenditions(renditions: Array<VideoRenditionProgress>, fallback: number): number {
  if (renditions.length === 0) {
    return fallback;
  }

  const readyCount = renditions.filter((row) => row.status.toUpperCase() === "READY").length;
  const encodingShare = renditions.reduce((sum, row) => {
    const normalized = row.status.toUpperCase();

    if (normalized === "READY") {
      return sum + 100;
    }

    if (normalized === "FAILED") {
      return sum;
    }

    return sum + Math.min(100, Math.max(0, row.progress_pct));
  }, 0);
  const average = encodingShare / renditions.length;

  if (readyCount === renditions.length) {
    return 100;
  }

  // Map average rung progress onto the post-upload encode span (~8–100).
  return Math.max(fallback, Math.round(8 + (average / 100) * 92));
}

type ProcessTraceProps = {
  status: VideoUploadStatusResponse | null;
  recoveringLabel?: string | null;
  onRecoverRendition?: (label: string) => void;
};

export function ProcessTrace({ status, recoveringLabel = null, onRecoverRendition }: ProcessTraceProps) {
  const renditions = status?.renditions ?? [];
  const serverOverall = status?.overall_progress_pct ?? 0;
  const overall = overallFromRenditions(renditions, serverOverall);
  const pipelineStatus = status?.status ?? "UPLOADED";

  if (renditions.length === 0) {
    return (
      <div className="flex w-full flex-col gap-3">
        <Trace>
          <TraceLine status="running">
            <TraceIcon>
              <LoaderCircleIcon className="animate-spin" />
            </TraceIcon>

            <TraceTitle>
              {pipelineStatus === "PROBING"
                ? "Probing source media"
                : pipelineStatus === "QUEUED"
                  ? "Queued for encoding"
                  : "Preparing encode ladder"}
            </TraceTitle>

            <TraceDescription>{Math.round(overall)}%</TraceDescription>
          </TraceLine>
        </Trace>

        <Progress value={overall} className="h-2 w-full" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Trace className="w-full">
        {renditions.map((row) => {
          const lineStatus = traceStatusFor(row.status);
          const openByDefault = row.status.toUpperCase() === "ENCODING" || row.status.toUpperCase() === "FAILED";
          const recovering = recoveringLabel === row.label;

          return (
            <TraceCollapsible key={row.label} defaultOpen={openByDefault} className="w-full">
              <TraceCollapsibleTrigger className="w-full max-w-none">
                <TraceLine status={lineStatus} className="w-full max-w-none">
                  <TraceIcon>
                    <StatusIcon status={row.status} />
                  </TraceIcon>

                  <TraceTitle className="grow">
                    {row.label}
                    <span className="text-muted-foreground ml-2 font-normal">
                      {row.width}×{row.height} · {row.video_kbps} kbps
                    </span>
                  </TraceTitle>

                  <TraceDescription>{descriptionFor(row)}</TraceDescription>
                </TraceLine>
              </TraceCollapsibleTrigger>

              <TraceCollapsibleContent className="w-full">
                <div className="flex w-full flex-col gap-2 py-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>Encode progress</span>

                    <span className="tabular-nums">{row.progress_pct}%</span>
                  </div>

                  <Progress value={row.progress_pct} className="h-1.5 w-full" />

                  {row.segment_count != null && row.segment_count > 0 ? (
                    <p className="text-xs">{row.segment_count} TS segments written</p>
                  ) : null}

                  {row.playlist_key ? <p className="font-mono text-xs break-all">{row.playlist_key}</p> : null}

                  {isRecoverable(row) && onRecoverRendition != null ? (
                    <div className="flex items-center justify-end pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={recovering || recoveringLabel != null}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onRecoverRendition(row.label);
                        }}
                      >
                        {recovering ? (
                          <LoaderCircleIcon className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcwIcon className="size-3.5" />
                        )}
                        {recovering ? "Recovering…" : "Recover encode"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </TraceCollapsibleContent>
            </TraceCollapsible>
          );
        })}
      </Trace>

      <div className="flex w-full flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Overall</span>

          <span className="tabular-nums">{Math.round(overall)}%</span>
        </div>

        <Progress value={overall} className="h-2 w-full" />

        {status?.error_message ? <p className="text-destructive text-xs">{status.error_message}</p> : null}
      </div>
    </div>
  );
}
