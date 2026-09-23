import { createFileRoute, Link } from "@tanstack/react-router";

import { SignInForm } from "@/components/auth/sign-in-form";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

          <p className="text-sm text-muted-foreground">Sign in with the email and password for your account.</p>
        </div>

        <SignInForm />

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
