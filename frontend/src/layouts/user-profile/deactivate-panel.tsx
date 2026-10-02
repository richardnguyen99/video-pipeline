import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeactivatePanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-destructive">Deactivate account</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Temporarily disable your Velvet account and hide your public profile. Your data will be kept safe.
          </p>

          <div className="mt-4">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
                Deactivate account
              </DialogTrigger>

              <DialogContent className="max-w-md gap-0">
                <div className="px-5 py-4">
                  <DialogTitle className="text-lg font-semibold text-destructive">Deactivate your account?</DialogTitle>

                  <DialogDescription className="mt-2 text-sm text-muted-foreground">
                    Your profile, videos, playlists, and subscriptions will be hidden until you sign in and reactivate
                    your account.
                  </DialogDescription>
                </div>

                <DialogFooter className="items-center justify-between gap-3 border-t border-border">
                  <p className="text-xs text-muted-foreground italic">This action cannot be reversed</p>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                      }}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <p className="mt-3 text-xs text-destructive/80">This action cannot be reversed.</p>
        </div>
      </div>
    </div>
  );
}
