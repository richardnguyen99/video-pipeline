import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RenamePlaylistDialogProps = {
  open: boolean;
  isPending: boolean;
  currentName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
};

export function RenamePlaylistDialog({
  open,
  isPending,
  currentName,
  onOpenChange,
  onSubmit,
}: RenamePlaylistDialogProps) {
  const [name, setName] = useState(currentName);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== currentName.trim() && !isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) {
          return;
        }

        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Rename playlist</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Choose a new name for this playlist.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-2 px-5 pb-4">
          <Label htmlFor="rename-playlist-name">Name</Label>

          <Input
            id="rename-playlist-name"
            value={name}
            maxLength={255}
            autoComplete="off"
            disabled={isPending}
            onChange={(event) => {
              setName(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) {
                event.preventDefault();
                onSubmit(trimmed);
              }
            }}
          />
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <div className="flex w-full justify-end gap-2">
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

            <Button
              type="button"
              size="sm"
              disabled={!canSubmit}
              onClick={() => {
                onSubmit(trimmed);
              }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
