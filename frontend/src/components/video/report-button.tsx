import { useState } from "react";
import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { VideoActionButton } from "./video-action-button";

export type ReportReason = "illegal" | "stream" | "dmca" | "wrong_video" | "metadata";

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "illegal", label: "Illegal content" },
  { id: "stream", label: "Stream not working" },
  { id: "dmca", label: "DMCA / Copyright content" },
  {
    id: "wrong_video",
    label: "Wrong video (playing video does not match video id)",
  },
  { id: "metadata", label: "Request to add/modify metadata" },
];

const VIDEO_FIELDS = [
  "title",
  "released_date",
  "description",
  "genres",
  "actresses",
  "director",
  "maker",
  "label",
] as const;

type VideoField = (typeof VIDEO_FIELDS)[number];
type Action = "add" | "remove" | "modify";
interface ReportButtonProps {
  onClick: () => void;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: 1 | 2;
  reason: ReportReason | null;
  onSelectReason: (r: ReportReason) => void;
  onBack: () => void;
}

export type ReportDialogProps = {};

export function ReportButton({
  onClick,
  className,
  open,
  onOpenChange,
  step,
  onSelectReason,
  onBack,
}: ReportButtonProps) {
  const [rows, setRows] = useState<
    Array<{
      field: VideoField;
      action: Action;
      newValue: string;
      oldValue: string;
    }>
  >([{ field: "title", action: "modify", newValue: "", oldValue: "" }]);
  return (
    <>
      <VideoActionButton tooltip="Report" className={className} onClick={onClick}>
        <Flag className="size-4" />
        <span>Report</span>
      </VideoActionButton>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{step === 1 ? "Report video" : "Request metadata change"}</DialogTitle>
            <DialogClose />
          </DialogHeader>

          <div className="space-y-4 pb-2">
            {step === 1 && (
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="flex w-full items-center rounded-lg border border-border px-4 py-3 text-left text-sm hover:bg-muted"
                    onClick={() => onSelectReason(r.id)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <>
                <DialogDescription>Describe the metadata changes you want applied.</DialogDescription>
                {rows.map((row, idx) => (
                  <div key={idx} className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={row.field}
                        onChange={(e) => {
                          const field = e.target.value as VideoField;
                          setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, field } : r)));
                        }}
                      >
                        {VIDEO_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={row.action}
                        onChange={(e) => {
                          const action = e.target.value as Action;
                          setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, action } : r)));
                        }}
                      >
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                        <option value="modify">Modify</option>
                      </select>
                    </div>
                    {(row.action === "add" || row.action === "modify") && (
                      <input
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        placeholder="New value"
                        value={row.newValue}
                        onChange={(e) =>
                          setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, newValue: e.target.value } : r)))
                        }
                      />
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() =>
                    setRows((r) => [
                      ...r,
                      {
                        field: "title",
                        action: "modify",
                        newValue: "",
                        oldValue: "",
                      },
                    ])
                  }
                >
                  + Add another change
                </button>
                <DialogFooter className="px-0">
                  <Button variant="outline" size="sm" onClick={onBack}>
                    Back
                  </Button>
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Submit
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
