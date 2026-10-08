import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlaylistVisibility } from "@/queries/playlist";

export type PlaylistCreateSubmit = {
  name: string;
  visibility: PlaylistVisibility;
};

type PlaylistCreateDialogProps = {
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: PlaylistCreateSubmit) => void;
};

const VISIBILITY_OPTIONS: Array<{
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

export function PlaylistCreateDialog({ open, isPending, onOpenChange, onSubmit }: PlaylistCreateDialogProps) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<PlaylistVisibility>("private");

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !isPending;

  const reset = () => {
    setName("");
    setVisibility("private");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }

        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">New playlist</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Create a playlist and choose who can see it.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-4">
          <div className="flex flex-col gap-2">
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
                  onSubmit({ name: trimmed, visibility });
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Visibility</Label>

            <div className="flex flex-col gap-2">
              {VISIBILITY_OPTIONS.map((option) => {
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
                    <span className="text-sm font-medium">{option.label}</span>

                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
                onSubmit({ name: trimmed, visibility });
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
