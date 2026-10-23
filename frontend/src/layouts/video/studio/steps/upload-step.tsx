import { Check, CloudUpload, FileVideo, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { UploadPhase } from "@/layouts/video/studio/types";
import { cn } from "@/libs/utils";

type UploadStepProps = {
  fileName: string | null;
  phase: UploadPhase;
  progressPct: number;
  message: string | null;
  autoProcess: boolean;
  busy: boolean;
  onAutoProcessChange: (value: boolean) => void;
  onResolveConflict: () => void;
  onRetry: () => void;
};

export function UploadStep({
  fileName,
  phase,
  progressPct,
  message,
  autoProcess,
  busy,
  onAutoProcessChange,
  onResolveConflict,
  onRetry,
}: UploadStepProps) {
  return (
    <div className="flex w-full flex-col gap-4 py-2">
      <div className="flex items-start gap-4">
        <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : phase === "done" ? (
            <Check className="size-5 text-emerald-500" />
          ) : phase === "error" || phase === "conflict" ? (
            <X className="size-5 text-destructive" />
          ) : (
            <CloudUpload className="size-5" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-base font-medium">
            {phase === "done"
              ? "Upload complete"
              : phase === "error"
                ? "Upload failed"
                : phase === "conflict"
                  ? "Video code already exists"
                  : "Uploading your video"}
          </h3>

          <p
            className={cn(
              "text-sm",
              phase === "error" || phase === "conflict"
                ? "text-destructive"
                : phase === "done"
                  ? "text-emerald-500"
                  : "text-muted-foreground",
            )}
          >
            {phase === "error" || phase === "conflict"
              ? (message ?? "Something went wrong.")
              : phase === "done"
                ? (message ?? "Your video finished uploading.")
                : "Your video is being uploaded directly to object storage."}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center gap-3 rounded-lg border p-3 text-left">
        <FileVideo className="size-4 shrink-0" />

        <span className="min-w-0 flex-1 truncate text-sm">{fileName ?? "Selected video"}</span>

        <strong className="text-sm tabular-nums">{progressPct}%</strong>
      </div>

      <Progress value={progressPct} className="h-2 w-full" />

      <label className="flex w-full items-start gap-2 text-left text-sm">
        <Checkbox
          checked={autoProcess}
          disabled={busy}
          onCheckedChange={(checked) => {
            onAutoProcessChange(checked === true);
          }}
        />

        <span>Automatically continue to processing when upload completes</span>
      </label>

      {phase === "conflict" ? (
        <Button type="button" variant="outline" className="self-start" onClick={onResolveConflict}>
          Resolve conflict
        </Button>
      ) : null}

      {phase === "error" ? (
        <Button type="button" variant="outline" className="self-start" onClick={onRetry}>
          Retry upload
        </Button>
      ) : null}
    </div>
  );
}
