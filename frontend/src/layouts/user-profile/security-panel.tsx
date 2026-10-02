import { ChangePasswordForm } from "@/layouts/auth/change-password-form";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import type { UserProfile } from "@/libs/auth";

type SecurityPanelProps = {
  user: UserProfile;
};

export function SecurityPanel({ user }: SecurityPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Change email"
        description="Update the email address used to sign in and receive account notices."
        action={
          <Button type="button" size="sm">
            Change email
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Current email</p>

            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
            {user.email_verified ? "Verified" : "Unverified"}
          </span>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Change username"
        description="Your username appears on your profile and public video pages."
        action={
          <Button type="button" size="sm">
            Change username
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Current username</p>

            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>

          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Available
          </span>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Change password"
        description="Choose a strong password you do not use anywhere else. After updating, every device is signed out."
      >
        <ChangePasswordForm />
      </SettingsCard>

      <SettingsCard
        title="Sessions"
        description="Review where your Velvet account is currently signed in."
        action={
          <Button type="button" variant="outline" size="sm">
            Sign out all
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
            <div>
              <p className="text-sm font-medium">This browser</p>

              <p className="text-xs text-muted-foreground">Active now</p>
            </div>

            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">Current</span>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
