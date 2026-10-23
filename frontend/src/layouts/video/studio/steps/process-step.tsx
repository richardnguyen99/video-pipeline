import { Check, Loader2, X } from "lucide-react";

import { ProcessTrace } from "@/layouts/video/studio/process-trace";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";

type ProcessStepProps = {
  status: VideoUploadStatusResponse | null;
};

function isLadderReady(status: VideoUploadStatusResponse | null): boolean {
  if (status == null || status.renditions.length === 0) {
    return false;
  }

  return status.renditions.every((row) => row.status.toUpperCase() === "READY");
}

export function ProcessStep({ status }: ProcessStepProps) {
  const failed = status?.status === "FAILED";
  const ready = isLadderReady(status);

  return (
    <div className="flex w-full flex-col gap-4 py-2">
      <div className="flex items-start gap-4">
        <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
          {failed ? (
            <X className="size-5 text-destructive" />
          ) : ready ? (
            <Check className="size-5 text-emerald-500" />
          ) : (
            <Loader2 className="size-5 animate-spin" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-base font-medium">Processing your video</h3>

          <p className="text-muted-foreground text-sm">
            {failed
              ? status.error_message
              : ready
                ? "All resolutions encoded. Continue to preview."
                : "Encoding each resolution into HLS streams. Lower rungs finish first so playback can start early."}
          </p>
        </div>
      </div>

      <ProcessTrace status={status} />
    </div>
  );
}
