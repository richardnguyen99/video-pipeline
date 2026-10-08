import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { PlaylistVisibility } from "@/queries/playlist";

type ChangeVisibilityDialogProps = {
  open: boolean;
  isPending: boolean;
  currentVisibility: PlaylistVisibility;
  onOpenChange: (open: boolean) => void;
  onSubmit: (visibility: PlaylistVisibility) => void;
};

const OPTIONS: Array<{
  value: PlaylistVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Private",
    description: "Only you can see this playlist.",
  },
  {
    value: "restricted",
    label: "Restricted",
    description: "Only people you share with can see this playlist.",
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone can see this playlist.",
  },
];

export function ChangeVisibilityDialog({
  open,
  isPending,
  currentVisibility,
  onOpenChange,
  onSubmit,
}: ChangeVisibilityDialogProps) {
  const [visibility, setVisibility] = useState<PlaylistVisibility>(currentVisibility);

  const canSubmit = visibility !== currentVisibility && !isPending;

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
          <DialogTitle className="text-lg font-semibold">Change visibility</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Control who can see this playlist.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-2 px-5 pb-4">
          {OPTIONS.map((option) => {
            const selected = visibility === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                className={
                  selected
                    ? "flex flex-col items-start gap-0.5 rounded-lg border border-primary bg-primary/10 px-3 py-2.5 text-left transition-colors"
                    : "flex flex-col items-start gap-0.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-left transition-colors hover:border-border"
                }
                onClick={() => {
                  setVisibility(option.value);
                }}
              >
                <Label className="pointer-events-none text-sm font-medium">{option.label}</Label>

                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            );
          })}
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
                onSubmit(visibility);
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
