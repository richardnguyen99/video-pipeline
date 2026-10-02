import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import type { BlockedAccount } from "@/queries/user-profile";

type BlockedAccountsPanelProps = {
  username: string;
  accounts: Array<BlockedAccount>;
};

export function BlockedAccountsPanel({ username, accounts }: BlockedAccountsPanelProps) {
  const queryClient = useQueryClient();

  return (
    <SettingsCard
      title="Blocked accounts"
      description="Review the people you have blocked and restore access whenever you are ready."
      action={
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {accounts.length} blocked
        </span>
      }
    >
      <div className="flex flex-col gap-1">
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {account.initials}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{account.name}</p>

              <p className="text-xs text-muted-foreground">
                {account.username} · {account.blocked_at}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.setQueryData<Array<BlockedAccount>>(["user-blocked", username], (current) =>
                  (current ?? []).filter((row) => row.id !== account.id),
                );
              }}
            >
              Unblock
            </Button>
          </div>
        ))}

        {accounts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No blocked accounts.</p>
        ) : null}
      </div>
    </SettingsCard>
  );
}
