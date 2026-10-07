import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PlaylistCreateDialogProps = {
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
};

export function PlaylistCreateDialog({ open, isPending, onOpenChange, onSubmit }: PlaylistCreateDialogProps) {
  const [name, setName] = useState("");

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setName("");
        }

        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">New playlist</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Create a private playlist to save videos for later.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-2 px-5 pb-4">
          <Label htmlFor="playlist-name">Name</Label>

          <Input
            id="playlist-name"
            value={name}
            maxLength={255}
            placeholder="Watch later"
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
              Create
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
