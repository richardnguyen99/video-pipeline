import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { SignInForm } from "@/components/auth/sign-in-form";

const signInSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_guest/sign-in")({
  validateSearch: signInSearchSchema,
  component: SignInPage,
});

function SignInPage() {
  const { redirect: redirectTo } = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

          <p className="text-sm text-muted-foreground">Sign in with the email and password for your account.</p>
        </div>

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
