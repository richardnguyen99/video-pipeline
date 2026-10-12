import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { confirmNewEmailChange, getApiErrorMessage } from "@/libs/auth";
import { useAuthStore } from "@/stores/auth-store";

const searchSchema = z.object({
  token: z.string().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/verify-email-change")({
  validateSearch: searchSchema,
  component: VerifyEmailChangePage,
});

function VerifyEmailChangePage() {
  const { token } = Route.useSearch();
  const setUser = useAuthStore((state) => state.setUser);
  const cancelledRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Confirming your new email…" : "Missing verification token.");

  useEffect(() => {
    if (!token) {
      return;
    }

    cancelledRef.current = false;

    void (async () => {
      try {
        const profile = await confirmNewEmailChange(token);

        if (cancelledRef.current) {
          return;
        }

        const current = useAuthStore.getState().user;

        if (current != null && current.id === profile.id) {
          setUser({ ...current, ...profile });
        }

        setStatus("ok");
        setMessage("Your email has been updated and verified.");
      } catch (error) {
        if (cancelledRef.current) {
          return;
        }

        setStatus("error");
        setMessage(getApiErrorMessage(error));
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [token, setUser]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Confirm new email</h1>

        {status === "loading" ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {message}
          </p>
        ) : (
          <p className={status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message}</p>
        )}

        {status === "ok" || status === "error" ? (
          <Button render={<Link to="/" />} variant={status === "ok" ? "default" : "outline"}>
            Continue
          </Button>
        ) : null}
      </div>
    </div>
  );
}
