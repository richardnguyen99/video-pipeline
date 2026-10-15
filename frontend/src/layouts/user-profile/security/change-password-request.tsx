import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage, requestChangePasswordLink } from "@/libs/auth";

type ChangePasswordSectionProps = {
  email: string;
};

export function ChangePasswordSection({ email }: ChangePasswordSectionProps) {
  const [pending, setPending] = useState(false);

  async function handleRequest() {
    setPending(true);

    try {
      const result = await requestChangePasswordLink();
      toast.add({
        type: "success",
        title: "Password link sent",
        description: result.detail,
        timeout: 4000,
      });
    } catch (err) {
      toast.add({
        type: "error",
        title: "Could not send password link",
        description: getApiErrorMessage(err),
        timeout: 4000,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsCard
      title="Change password"
      description="We email a temporary link so you can confirm your identity and set a new password. All devices are signed out when the change completes."
      action={
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            void handleRequest();
          }}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            "Change password"
          )}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Use the button to send a password-change link to <span className="font-medium text-foreground">{email}</span>.
      </p>
    </SettingsCard>
  );
}
