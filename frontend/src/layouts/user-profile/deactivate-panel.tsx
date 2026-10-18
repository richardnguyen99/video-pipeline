import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/libs/auth";
import { applyAuthSession } from "@/libs/auth-session";
import { deactivateMyAccount } from "@/queries/account-deactivate";

type DeactivatePanelProps = {
  username: string;
};

export function DeactivatePanel({ username }: DeactivatePanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const deactivateMutation = useMutation({
    mutationFn: deactivateMyAccount,
    onSuccess: async () => {
      setOpen(false);

      try {
        await signOut();
      } catch {
        applyAuthSession(queryClient, null);
      }

      toast.add({
        type: "success",
        title: "Account deactivated",
        description: "Your account has been deactivated and all sessions ended.",
        timeout: 5000,
      });

      await navigate({
        to: "/",
        replace: true,
      });
    },
    onError: async (mutationError) => {
      const message = getApiErrorMessage(mutationError);
      const lowered = message.toLowerCase();
      const sessionEnded =
        lowered.includes("revoked") || lowered.includes("not authenticated") || lowered.includes("disabled");

      if (sessionEnded) {
        setOpen(false);

        try {
          await signOut();
        } catch {
          applyAuthSession(queryClient, null);
        }

        toast.add({
          type: "success",
          title: "Account deactivated",
          description: "Your account has been deactivated and all sessions ended.",
          timeout: 5000,
        });

        await navigate({
          to: "/u/$username",
          params: { username },
          replace: true,
        });

        return;
      }

      toast.add({
        type: "error",
        title: "Could not deactivate account",
        description: message,
        timeout: 5000,
      });
    },
  });

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-destructive">Deactivate account</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Disable your Velvet account and hide your public profile. Your data is retained, but you will be signed out
            on every device.
          </p>

          <div className="mt-4">
            <Dialog
              open={open}
              onOpenChange={(next) => {
                if (deactivateMutation.isPending) {
                  return;
                }

                setOpen(next);
              }}
            >
              <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
                Deactivate account
              </DialogTrigger>

              <DialogContent className="max-w-md gap-0">
                <div className="px-5 py-4">
                  <DialogTitle className="text-lg font-semibold text-destructive">Deactivate your account?</DialogTitle>

                  <DialogDescription className="mt-2 text-sm text-muted-foreground">
                    This will disable your account, end every signed-in session, and hide your profile. This action
                    cannot be reversed from the app.
                  </DialogDescription>
                </div>

                <DialogFooter className="items-center justify-between gap-3 border-t border-border">
                  <p className="text-xs text-muted-foreground italic">This action cannot be reversed</p>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={deactivateMutation.isPending}
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
                      disabled={deactivateMutation.isPending}
                      onClick={() => {
                        deactivateMutation.mutate();
                      }}
                    >
                      {deactivateMutation.isPending ? "Deactivating…" : "Confirm"}
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
