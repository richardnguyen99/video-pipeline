import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { VISIBILITY_OPTIONS } from "@/layouts/video/studio/types";
import type { VisibilityValue } from "@/layouts/video/studio/types";
import { cn } from "@/libs/utils";

type ManageAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVisibility: VisibilityValue;
  isPending?: boolean;
  onRequestChange: (next: VisibilityValue) => void;
};

export function ManageAccessDialog({
  open,
  onOpenChange,
  currentVisibility,
  isPending = false,
  onRequestChange,
}: ManageAccessDialogProps) {
  const [selected, setSelected] = useState<VisibilityValue | null>(null);

  const displaySelected = selected !== null ? selected : currentVisibility;

  const isUnchanged = displaySelected === currentVisibility;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelected(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Manage access</DialogTitle>

          <DialogDescription className="text-muted-foreground mt-2 text-sm">
            Choose who can find and watch this video. Changes apply after you confirm.
          </DialogDescription>

          <div className="mt-4 flex flex-col gap-3">
            {VISIBILITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  displaySelected === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                )}
              >
                <input
                  type="radio"
                  name="manage-access-visibility"
                  value={option.value}
                  checked={displaySelected === option.value}
                  disabled={isPending}
                  className="mt-1"
                  onChange={() => {
                    setSelected(option.value);
                  }}
                />

                <span className="flex flex-col gap-0.5">
                  <strong className="text-sm font-medium">{option.label}</strong>

                  <small className="text-muted-foreground text-xs">{option.description}</small>
                </span>
              </label>
            ))}
          </div>
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

          <Button
            type="button"
            size="sm"
            disabled={isPending || isUnchanged}
            onClick={() => {
              onRequestChange(displaySelected);
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACCESS_CONFIRM_MESSAGES: Record<VisibilityValue, string> = {
  public: "Changing the access to public will make this video visible to all users.",
  unlisted: "Changing the access to restricted will make this video only visible to shared users.",
  private: "Changing the access to private will make this video only visible to you.",
};

type ConfirmAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextVisibility: VisibilityValue | null;
  isPending?: boolean;
  onConfirm: () => void;
};

export function ConfirmAccessDialog({
  open,
  onOpenChange,
  nextVisibility,
  isPending = false,
  onConfirm,
}: ConfirmAccessDialogProps) {
  const message = nextVisibility != null ? ACCESS_CONFIRM_MESSAGES[nextVisibility] : "Confirm this access change.";

  const label =
    nextVisibility != null ? VISIBILITY_OPTIONS.find((option) => option.value === nextVisibility)?.label : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">
            {label != null ? `Change access to ${label}?` : "Change access?"}
          </DialogTitle>

          <DialogDescription className="text-muted-foreground mt-2 text-sm">{message}</DialogDescription>
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

          <Button type="button" size="sm" disabled={isPending || nextVisibility == null} onClick={onConfirm}>
            {isPending ? "Updating…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
