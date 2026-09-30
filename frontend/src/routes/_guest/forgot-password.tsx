import { createFileRoute, Link } from "@tanstack/react-router";

import { ForgotPasswordForm } from "@/layouts/auth/forgot-password-form";

export const Route = createFileRoute("/_guest/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>

          <p className="text-sm text-muted-foreground">
            Enter the email for your account. If it matches a registration, we will send a reset link that expires in 15
            minutes.
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/sign-in" className="font-medium text-primary hover:text-primary-active">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
