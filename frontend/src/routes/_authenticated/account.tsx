import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/" });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-6 pt-24 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

        <p className="text-sm text-muted-foreground">Signed-in profile details.</p>
      </div>

      <dl className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-6 text-sm">
        <div className="space-y-1">
          <dt className="text-muted-foreground">Username</dt>

          <dd className="font-medium">{user?.username}</dd>
        </div>

        <div className="space-y-1">
          <dt className="text-muted-foreground">Email</dt>

          <dd className="font-medium">{user?.email}</dd>
        </div>

        {user?.display_name ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Display name</dt>

            <dd className="font-medium">{user.display_name}</dd>
          </div>
        ) : null}
      </dl>

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
