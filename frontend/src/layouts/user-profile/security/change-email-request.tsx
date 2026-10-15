import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage, requestChangeEmailLink } from "@/libs/auth";

type ChangeEmailSectionProps = {
  email: string;
  emailVerified: boolean;
};

export function ChangeEmailSection({ email, emailVerified }: ChangeEmailSectionProps) {
  const [pending, setPending] = useState(false);

  async function handleRequest() {
    setPending(true);

    try {
      const result = await requestChangeEmailLink();
      toast.add({
        type: "success",
        title: "Email link sent",
        description: result.detail,
        timeout: 4000,
      });
    } catch (err) {
      toast.add({
        type: "error",
        title: "Could not send email link",
        description: getApiErrorMessage(err),
        timeout: 4000,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsCard
      title="Change email"
      description="Update the email address used to sign in and receive account notices."
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
            "Change email"
          )}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Current email</p>

          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
          {emailVerified ? "Verified" : "Unverified"}
        </span>
      </div>
    </SettingsCard>
  );
}
