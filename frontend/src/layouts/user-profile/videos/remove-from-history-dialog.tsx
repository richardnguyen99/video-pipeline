import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

type RemoveFromHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
};

export function RemoveFromHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: RemoveFromHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Remove from watch history?</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            This video will be removed from your recent watch history. You can still find it elsewhere on the site.
          </DialogDescription>
        </div>

        <DialogFooter className="items-center justify-between gap-3 border-t border-border">
          <p className="text-xs text-muted-foreground italic">This action cannot be reversed</p>

          <div className="flex shrink-0 gap-2">
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

            <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onConfirm}>
              Confirm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
