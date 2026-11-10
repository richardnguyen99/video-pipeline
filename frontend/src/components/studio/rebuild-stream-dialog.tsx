import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

type RebuildStreamDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  videoLabel?: string;
};

export function RebuildStreamDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  videoLabel,
}: RebuildStreamDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Rebuild this stream?</DialogTitle>

          <DialogDescription className="text-muted-foreground mt-2 text-sm">
            {videoLabel != null && videoLabel.length > 0 ? (
              <>
                All resolution encodings for <span className="text-foreground font-medium">{videoLabel}</span> will be
                reset and re-queued. Playback may be unavailable until encoding finishes again.
              </>
            ) : (
              "All resolution encodings will be reset and re-queued. Playback may be unavailable until encoding finishes again."
            )}
          </DialogDescription>
        </div>

        <DialogFooter className="border-border items-center justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>

          <Button type="button" size="sm" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Starting…" : "Rebuild stream"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
