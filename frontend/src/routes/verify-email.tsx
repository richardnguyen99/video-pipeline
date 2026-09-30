import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { confirmEmailVerification, getApiErrorMessage } from "@/libs/auth";
import { useAuthStore } from "@/stores/auth-store";

const searchSchema = z.object({
  token: z.string().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const setUser = useAuthStore((state) => state.setUser);
  const cancelledRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Confirming your email…" : "Missing verification token.");

  useEffect(() => {
    if (!token) {
      return;
    }

    cancelledRef.current = false;

    void (async () => {
      try {
        const profile = await confirmEmailVerification(token);

        if (cancelledRef.current) {
          return;
        }

        const current = useAuthStore.getState().user;

        if (current != null && current.id === profile.id) {
          setUser({ ...current, ...profile, email_verified: true });
        }

        setStatus("ok");
        setMessage("Your email is verified. You can continue using Velvet.");
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
        <h1 className="text-2xl font-semibold tracking-tight">Email verification</h1>

        {status === "loading" ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {message}
          </p>
        ) : (
          <p
            className={status === "ok" ? "text-sm text-foreground" : "text-sm text-destructive"}
            role={status === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}

        <div className="flex flex-col items-center gap-2">
          <Button nativeButton={false} render={<Link to="/account" />}>
            Account
          </Button>

          <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
