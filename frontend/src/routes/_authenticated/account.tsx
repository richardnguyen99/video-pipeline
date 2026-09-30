import { useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2, LogOut, Mail } from "lucide-react";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage, requestEmailVerification } from "@/libs/auth";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    await router.invalidate();
    void navigate({ to: "/" });
  }

  async function handleRequestVerification() {
    setVerifyPending(true);
    setVerifyMessage(null);
    setVerifyError(null);

    try {
      const result = await requestEmailVerification();
      setVerifyMessage(result.detail);
    } catch (error) {
      setVerifyError(getApiErrorMessage(error));
    } finally {
      setVerifyPending(false);
    }
  }

  const needsVerification = user != null && user.email_verified !== true;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-10 px-6 pt-24 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

        <p className="text-sm text-muted-foreground">Signed-in profile details.</p>
      </div>

      {needsVerification ? (
        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />

            <div className="space-y-1">
              <p className="font-medium text-foreground">Verify your email</p>

              <p className="text-muted-foreground">
                Confirm <span className="font-medium text-foreground">{user.email}</span> to secure your account. The
                link expires in 15 minutes.
              </p>
            </div>
          </div>

          {verifyMessage ? (
            <p className="text-foreground" role="status">
              {verifyMessage}
            </p>
          ) : null}

          {verifyError ? (
            <p className="text-destructive" role="alert">
              {verifyError}
            </p>
          ) : null}

          <Button
            type="button"
            size="sm"
            disabled={verifyPending}
            onClick={() => {
              void handleRequestVerification();
            }}
          >
            {verifyPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send verification email"
            )}
          </Button>
        </div>
      ) : null}

      <dl className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-6 text-sm">
        <div className="space-y-1">
          <dt className="text-muted-foreground">Username</dt>

          <dd className="font-medium">{user?.username}</dd>
        </div>

        <div className="space-y-1">
          <dt className="text-muted-foreground">Email</dt>

          <dd className="font-medium">
            {user?.email}
            {user?.email_verified ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">Verified</span>
            ) : (
              <span className="ml-2 text-xs font-normal text-amber-600">Unverified</span>
            )}
          </dd>
        </div>

        {user?.display_name ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Display name</dt>

            <dd className="font-medium">{user.display_name}</dd>
          </div>
        ) : null}
      </dl>

      <section className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Change password</h2>

          <p className="text-sm text-muted-foreground">
            After updating, every device is signed out and you must sign in again with the new password.
          </p>
        </div>

        <ChangePasswordForm />
      </section>

      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          void handleSignOut();
        }}
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
