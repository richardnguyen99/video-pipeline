import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/libs/utils";

export type ActressReportReason =
  "wrong_avatar" | "wrong_name" | "wrong_ruby" | "wrong_measurement" | "illegal_age" | "dmca" | "abusive";

const REPORT_REASONS: { id: ActressReportReason; label: string; group?: string }[] = [
  { id: "wrong_avatar", label: "Wrong avatar image" },
  { id: "wrong_name", label: "Wrong actress name" },
  { id: "wrong_ruby", label: "Wrong ruby name" },
  { id: "wrong_measurement", label: "Wrong measurement" },
  { id: "illegal_age", label: "Illegal age", group: "Inappropriate" },
  { id: "dmca", label: "DMCA request", group: "Inappropriate" },
  { id: "abusive", label: "Abusive or harassing content", group: "Inappropriate" },
];

interface ActressReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActressReportDialog({ open, onOpenChange }: ActressReportDialogProps) {
  const [reason, setReason] = useState<ActressReportReason | null>(null);

  useEffect(() => {
    if (!open) setReason(null);
  }, [open]);

  function handleConfirm() {
    if (!reason) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <DialogTitle className="text-base sm:text-lg">Report a problem with this actress</DialogTitle>
          <DialogClose className="size-8" />
        </DialogHeader>

        <ScrollArea className="w-full ">
          <div className="px-3 py-3 max-h-[min(24rem,50vh)]">
            <ItemGroup>
              {REPORT_REASONS.map((item, index) => {
                const prev = REPORT_REASONS[index - 1];
                const showGroup = item.group && prev.group !== item.group;

                return (
                  <div key={item.id}>
                    {showGroup ? (
                      <p className="mt-3 mb-1.5 px-3 text-xs font-medium text-muted-foreground first:mt-0">
                        {item.group}
                      </p>
                    ) : null}
                    <Item
                      aria-pressed={reason === item.id}
                      onClick={() => setReason((_prev) => (_prev !== null && _prev === item.id ? null : item.id))}
                      className={cn(
                        reason === item.id && "border-primary bg-primary/15 text-foreground hover:bg-primary/20",
                        "cursor-pointer",
                      )}
                    >
                      <ItemContent>
                        <ItemTitle>{item.label}</ItemTitle>
                      </ItemContent>
                      {reason === item.id ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                    </Item>
                  </div>
                );
              })}
            </ItemGroup>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col gap-3 border-t border-border px-4 py-3 sm:flex-col">
          <p className="text-xs text-muted-foreground italic">
            *By clicking on this confirmation, you agree the report is correct and assume any legal matters to yourself
            if any.
          </p>
          <Button
            type="button"
            variant="destructive"
            className={cn("w-full cursor-pointer", !reason && "opacity-50 cursor-not-allowed")}
            disabled={!reason}
            onClick={handleConfirm}
          >
            Confirm report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
