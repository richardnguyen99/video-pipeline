import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChangeEmailSection } from "@/layouts/user-profile/security/change-email-request";
import { ChangePasswordSection } from "@/layouts/user-profile/security/change-password-request";
import { ChangeUsernameDialog } from "@/layouts/user-profile/security/change-username-dialog";
import { HistorySection } from "@/layouts/user-profile/security/history-section";
import { SessionsSection } from "@/layouts/user-profile/security/sessions-section";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import type { UserProfile } from "@/libs/auth";

type SecurityPanelProps = {
  user: UserProfile;
};

export function SecurityPanel({ user }: SecurityPanelProps) {
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <ChangeEmailSection email={user.email} emailVerified={user.email_verified} />

      <SettingsCard
        title="Change username"
        description="Your username appears on your profile and public video pages."
        action={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setUsernameDialogOpen(true);
            }}
          >
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

      <ChangeUsernameDialog
        open={usernameDialogOpen}
        currentUsername={user.username}
        onOpenChange={setUsernameDialogOpen}
      />

      <ChangePasswordSection email={user.email} />

      <SessionsSection />

      <HistorySection />
    </div>
  );
}
