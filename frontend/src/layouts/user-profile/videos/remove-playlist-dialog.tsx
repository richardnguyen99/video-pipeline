import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

type RemovePlaylistDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  playlistName?: string;
};

export function RemovePlaylistDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  playlistName,
}: RemovePlaylistDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Delete playlist?</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            {playlistName != null && playlistName.length > 0
              ? `“${playlistName}” and all of its videos will be removed from your library.`
              : "This playlist and all of its videos will be removed from your library."}
          </DialogDescription>
        </div>

        <DialogFooter className="items-center justify-between gap-3 border-t border-border">
          <p className="text-xs text-muted-foreground italic">This action cannot be reversed</p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>

            <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
              Confirm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
