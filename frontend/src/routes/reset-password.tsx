import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

const searchSchema = z.object({
  token: z.string().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>

          <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
        </div>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-destructive" role="alert">
            Missing reset token. Open the link from your email, or request a new one.
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/forgot-password" className="font-medium text-primary hover:text-primary-active">
            Request a new link
          </Link>
          {" · "}
          <Link to="/sign-in" className="font-medium text-primary hover:text-primary-active">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
