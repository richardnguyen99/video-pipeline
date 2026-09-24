import { createFileRoute, Link } from "@tanstack/react-router";

import { RegisterForm } from "@/components/auth/register-form";

export const Route = createFileRoute("/_guest/register")({
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Become a member</h1>

          <p className="text-sm text-muted-foreground">
            Create an account to save playlists, follow actresses, and more.
          </p>
        </div>

        <RegisterForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/sign-in" className="font-medium text-primary hover:text-primary-active">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
