import { FileVideo } from "lucide-react";

import type { RelationSelections, UploadPhase, VisibilityValue } from "@/layouts/video/studio/types";

type SessionSummaryProps = {
  fileName: string | null;
  fileSizeLabel: string;
  videoCode: string;
  visibility: VisibilityValue;
  relations: RelationSelections;
  phase: UploadPhase;
  progressPct: number;
};

export function SessionSummary({
  fileName,
  fileSizeLabel,
  videoCode,
  visibility,
  relations,
  phase,
  progressPct,
}: SessionSummaryProps) {
  const relationCount = Object.values(relations).reduce((sum, ids) => sum + ids.length, 0);

  return (
    <aside className="bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Library</span>

          <h3 className="text-sm font-semibold">Session summary</h3>
        </div>

        <FileVideo className="text-muted-foreground size-4" />
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Selected file</dt>

          <dd className="truncate font-medium">{fileName ?? "None"}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Size</dt>

          <dd className="font-medium">{fileSizeLabel || "—"}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Video code</dt>

          <dd className="truncate font-medium">{videoCode.trim() || "—"}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Visibility</dt>

          <dd className="font-medium capitalize">{visibility}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Relations</dt>

          <dd className="font-medium">{relationCount} linked</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Upload</dt>

          <dd className="font-medium">
            {phase === "idle" && "Not started"}
            {phase === "preparing" && "Preparing…"}
            {phase === "uploading" && `Uploading ${progressPct}%`}
            {phase === "completing" && "Finalizing…"}
            {phase === "done" && "Complete"}
            {phase === "error" && "Failed"}
            {phase === "conflict" && "Code in use"}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
