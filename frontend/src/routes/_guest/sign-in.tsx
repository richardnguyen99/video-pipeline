import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { SignInForm } from "@/components/auth/sign-in-form";

const signInSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  notice: z.enum(["password-updated"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_guest/sign-in")({
  validateSearch: signInSearchSchema,
  component: SignInPage,
});

function SignInPage() {
  const { redirect: redirectTo, notice } = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

          <p className="text-sm text-muted-foreground">Sign in with the email and password for your account.</p>
        </div>

        {notice === "password-updated" ? (
          <p
            className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
            role="status"
          >
            Password updated successfully. Please sign in with your new credentials.
          </p>
        ) : null}

        <SignInForm redirectTo={redirectTo} />

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to="/register" className="font-medium text-primary hover:text-primary-active">
            Become a member
          </Link>
        </p>
      </div>
    </div>
  );
}
