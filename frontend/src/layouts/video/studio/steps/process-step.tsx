import { Link } from "@tanstack/react-router";
import { Check, ExternalLink, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProcessTrace } from "@/layouts/video/studio/process-trace";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";

type ProcessStepProps = {
  status: VideoUploadStatusResponse | null;
  recoveringLabel?: string | null;
  onRecoverRendition?: (label: string) => void;
};

function readyRungCount(status: VideoUploadStatusResponse | null): number {
  if (status == null) {
    return 0;
  }

  return status.renditions.filter((row) => row.status.toUpperCase() === "READY").length;
}

function isLadderComplete(status: VideoUploadStatusResponse | null): boolean {
  if (status == null) {
    return false;
  }

  if (status.renditions.length === 0) {
    return status.status.toUpperCase() === "READY";
  }

  return status.renditions.every((row) => row.status.toUpperCase() === "READY");
}

function isPlayable(status: VideoUploadStatusResponse | null): boolean {
  if (status == null) {
    return false;
  }

  if (status.status.toUpperCase() === "READY") {
    return true;
  }

  return readyRungCount(status) > 0;
}

export function ProcessStep({ status, recoveringLabel = null, onRecoverRendition }: ProcessStepProps) {
  const failed = status?.status === "FAILED";
  const complete = isLadderComplete(status);
  const playable = isPlayable(status);
  const readyCount = readyRungCount(status);
  const totalCount = status?.renditions.length ?? 0;
  const failedCount = status?.renditions.filter((row) => row.status.toUpperCase() === "FAILED").length ?? 0;

  return (
    <div className="flex w-full flex-col gap-4 py-2">
      <div className="flex items-start gap-4">
        <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
          {failed ? (
            <X className="size-5 text-destructive" />
          ) : complete ? (
            <Check className="size-5 text-emerald-500" />
          ) : (
            <Loader2 className="size-5 animate-spin" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-base font-medium">Processing your video</h3>

          <p className="text-muted-foreground text-sm">
            {failed
              ? (status.error_message ?? "Encoding failed.")
              : complete
                ? "All resolutions encoded. Expand a resolution to re-encode it if playback is broken."
                : failedCount > 0
                  ? `${readyCount} of ${totalCount} resolutions ready · ${failedCount} failed. Expand a resolution to recover its encode.`
                  : playable
                    ? totalCount > 0
                      ? `${readyCount} of ${totalCount} resolutions ready. Open the stream in a new tab — this page keeps processing.`
                      : "A playable stream is ready. Open it in a new tab while remaining resolutions encode."
                    : "Encoding each resolution into HLS streams. Lower rungs finish first so playback can start early."}
          </p>
        </div>
      </div>

      {playable && status != null ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/videos/$id" params={{ id: String(status.id) }} target="_blank" rel="noreferrer" />}
          >
            Open stream in new tab
            <ExternalLink data-icon="inline-end" className="size-4" />
          </Button>

          <span className="text-muted-foreground text-xs">
            Bookmark or return via /studio/upload?publicId={status.public_id}
          </span>
        </div>
      ) : null}

      <ProcessTrace status={status} recoveringLabel={recoveringLabel} onRecoverRendition={onRecoverRendition} />
    </div>
  );
}
