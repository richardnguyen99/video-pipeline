import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ExistingVideoSummary } from "@/queries/video-upload";

type ConflictDialogProps = {
  open: boolean;
  message: string | null;
  existing: ExistingVideoSummary | null;
  onOpenChange: (open: boolean) => void;
  onLoadExisting: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
};

export function ConflictDialog({
  open,
  message,
  existing,
  onOpenChange,
  onLoadExisting,
  onOverwrite,
  onCancel,
}: ConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="flex flex-col gap-3 px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Video code already exists</DialogTitle>

          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {message ?? "This video code is already in use."}
          </DialogDescription>

          {existing != null ? (
            <dl className="bg-muted/40 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-left text-xs">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Record id</dt>

                <dd className="font-medium tabular-nums">{existing.id}</dd>
              </div>

              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Status</dt>

                <dd className="font-medium">{existing.status ?? "—"}</dd>
              </div>

              <div className="col-span-2 flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Title</dt>

                <dd className="font-medium">{existing.title ?? "—"}</dd>
              </div>

              {existing.cid != null && existing.cid.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">CID</dt>

                  <dd className="font-medium">{existing.cid}</dd>
                </div>
              ) : null}

              {existing.jancode != null && existing.jancode.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">JAN</dt>

                  <dd className="font-medium">{existing.jancode}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>

        <DialogFooter className="border-border flex flex-col gap-3 border-t px-5 py-4 sm:flex-col">
          <p className="text-muted-foreground text-xs">
            Load fills the form without uploading. Update replaces the source file.
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>

            <Button type="button" variant="secondary" size="sm" disabled={existing == null} onClick={onLoadExisting}>
              Load existing info
            </Button>

            <Button type="button" variant="destructive" size="sm" onClick={onOverwrite}>
              Update existing
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
