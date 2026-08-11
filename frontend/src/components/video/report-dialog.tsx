import { useEffect, useState } from "react";
import { ArrowLeft, PlusIcon, X } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/libs/utils";

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

const MULTI_VALUE_FIELDS = new Set(["genres", "actresses"]);

type VideoField = (typeof VIDEO_FIELDS)[number];
type Action = "add" | "remove" | "modify";

function getActionsForField(field: VideoField): Action[] {
  if (MULTI_VALUE_FIELDS.has(field)) {
    return ["add", "remove", "modify"];
  }
  return ["add", "modify"];
}

interface MetadataRow {
  field: VideoField;
  action: Action;
  newValue: string;
  oldValue: string;
}

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: 1 | 2;
  reason: ReportReason | null;
  onSelectReason: (reason: ReportReason) => void;
  onBack: () => void;
}

export function ReportDialog({ open, onOpenChange, step, onSelectReason, onBack }: ReportDialogProps) {
  const [rows, setRows] = useState<MetadataRow[]>([{ field: "title", action: "modify", newValue: "", oldValue: "" }]);

  useEffect(() => {
    if (!open) {
      setRows([{ field: "title", action: "modify", newValue: "", oldValue: "" }]);
    }
  }, [open]);

  function handleAddRow() {
    setRows((prev) => [...prev, { field: "title", action: "modify", newValue: "", oldValue: "" }]);
  }

  function updateRow(index: number, patch: Partial<MetadataRow>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const next = { ...row, ...patch };

        if (patch.field != null) {
          const allowed = getActionsForField(patch.field);

          if (!allowed.includes(next.action)) {
            next.action = allowed[0];
          }

          if (!MULTI_VALUE_FIELDS.has(patch.field)) {
            next.oldValue = "";
          }
        }

        return next;
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden">
        <DialogHeader className="flex-row items-center gap-2">
          {step === 2 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 hover:bg-muted"
              onClick={onBack}
              aria-label="Go back"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <DialogTitle className="min-w-0 flex-1 line-clamp-1">
            {step === 1 ? "Report video" : "Request metadata change"}
          </DialogTitle>
          <DialogClose
            render={
              <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 hover:bg-muted">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            }
          />
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              "space-y-2 px-5 py-4 transition-all duration-300 ease-out",
              step === 1
                ? "relative translate-x-0 opacity-100"
                : "pointer-events-none absolute inset-x-0 top-0 -translate-x-full opacity-0",
            )}
            aria-hidden={step !== 1}
          >
            {REPORT_REASONS.map((reportReason) => (
              <button
                key={reportReason.id}
                type="button"
                className="flex w-full items-center rounded-lg border border-border px-4 py-3 text-left text-sm hover:bg-muted"
                onClick={() => onSelectReason(reportReason.id)}
              >
                <span className="line-clamp-1">{reportReason.label}</span>
              </button>
            ))}
          </div>

          <div
            className={cn(
              "flex max-h-[min(70vh,calc(90vh-5rem))] flex-col transition-all duration-300 ease-out",
              step === 2
                ? "relative translate-x-0 opacity-100"
                : "pointer-events-none absolute inset-x-0 top-0 translate-x-full opacity-0",
            )}
            aria-hidden={step !== 2}
          >
            <DialogDescription className="shrink-0 px-5 pt-4 pb-2">
              Describe the metadata changes you want applied.
            </DialogDescription>

            <ScrollArea key={rows.length} className="h-[min(20rem,calc(90vh-14rem))] px-5">
              <div className="space-y-3 pb-2">
                {rows.map((row, idx) => {
                  const isMulti = MULTI_VALUE_FIELDS.has(row.field);
                  const actions = getActionsForField(row.field);

                  return (
                    <div key={idx} className="space-y-2 rounded-xl border border-border p-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Select
                          value={row.field}
                          onValueChange={(value) => {
                            if (value == null) return;
                            updateRow(idx, { field: value });
                          }}
                        >
                          <SelectTrigger className="min-w-0 flex-1 [&>span]:line-clamp-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIDEO_FIELDS.map((field) => (
                              <SelectItem key={field} value={field}>
                                {field}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={row.action}
                          onValueChange={(value) => {
                            if (value == null) return;
                            updateRow(idx, { action: value });
                          }}
                        >
                          <SelectTrigger className="min-w-0 flex-1 [&>span]:line-clamp-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {actions.map((action) => (
                              <SelectItem key={action} value={action}>
                                {action.charAt(0).toUpperCase() + action.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {row.action === "add" && (
                        <Input
                          placeholder={isMulti ? "New value(s) to add" : "New value"}
                          value={row.newValue}
                          onChange={(e) => updateRow(idx, { newValue: e.target.value })}
                        />
                      )}

                      {row.action === "remove" && isMulti && (
                        <Input
                          placeholder="Value(s) to remove"
                          value={row.newValue}
                          onChange={(e) => updateRow(idx, { newValue: e.target.value })}
                        />
                      )}

                      {row.action === "modify" && isMulti && (
                        <>
                          <Input
                            placeholder="Old value (match existing)"
                            value={row.oldValue}
                            onChange={(e) => updateRow(idx, { oldValue: e.target.value })}
                          />
                          <Input
                            placeholder="New value"
                            value={row.newValue}
                            onChange={(e) => updateRow(idx, { newValue: e.target.value })}
                          />
                        </>
                      )}

                      {row.action === "modify" && !isMulti && (
                        <Input
                          placeholder="New value"
                          value={row.newValue}
                          onChange={(e) => updateRow(idx, { newValue: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="shrink-0 space-y-3 border-t border-border px-5">
              <button type="button" className="text-sm text-primary hover:underline mt-2" onClick={handleAddRow}>
                <PlusIcon className="size-4 mr-1 inline-block" />
                Add another change
              </button>
              <DialogFooter className="px-0">
                <Button variant="outline" size="sm" onClick={onBack}>
                  Back
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Submit
                </Button>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
