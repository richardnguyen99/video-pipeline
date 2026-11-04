import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

type DeleteUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  videoLabel?: string;
};

export function DeleteUploadDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  videoLabel,
}: DeleteUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Delete this upload permanently?</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            {videoLabel != null && videoLabel.length > 0 ? (
              <>
                <span className="font-medium text-foreground">{videoLabel}</span> and its stream files, thumbnails, and
                samples will be removed.
              </>
            ) : (
              "This upload, the video row, stream files, thumbnails, and samples will be removed."
            )}
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
              {isPending ? "Deleting…" : "Delete video"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
