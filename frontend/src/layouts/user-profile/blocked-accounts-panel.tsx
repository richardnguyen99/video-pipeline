import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import { blockedAccountsQueryKeys, myBlockedAccountsQueryOptions, unblockUser } from "@/queries/blocked-accounts";
import type { BlockedAccount, BlockedAccountListResponse } from "@/queries/blocked-accounts";

function formatBlockedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `Blocked ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function displayNameFor(account: BlockedAccount): string {
  const name = account.display_name?.trim();

  if (name != null && name.length > 0) {
    return name;
  }

  return account.username;
}

type BlockedAccountsPanelProps = {
  initialBlocked?: BlockedAccountListResponse | null;
};

export function BlockedAccountsPanel({ initialBlocked = null }: BlockedAccountsPanelProps) {
  const queryClient = useQueryClient();
  const [pendingUnblock, setPendingUnblock] = useState<BlockedAccount | null>(null);

  const { data, isError, error } = useQuery({
    ...myBlockedAccountsQueryOptions(),
    ...(initialBlocked != null ? { initialData: initialBlocked } : {}),
  });

  const unblockMutation = useMutation({
    mutationFn: (blockedUserId: string) => unblockUser(blockedUserId),
    onMutate: async (blockedUserId) => {
      await queryClient.cancelQueries({
        queryKey: blockedAccountsQueryKeys.me(),
      });

      const previous = queryClient.getQueryData<BlockedAccountListResponse>(blockedAccountsQueryKeys.me());

      if (previous != null) {
        const items = previous.items.filter((row) => row.id !== blockedUserId);

        queryClient.setQueryData<BlockedAccountListResponse>(blockedAccountsQueryKeys.me(), {
          items,
          total: items.length,
        });
      }

      return { previous };
    },
    onSuccess: (_data, blockedUserId) => {
      const label =
        pendingUnblock != null && pendingUnblock.id === blockedUserId ? displayNameFor(pendingUnblock) : "Account";

      setPendingUnblock(null);

      toast.add({
        type: "success",
        title: "Account unblocked",
        description: `${label} can interact with you again.`,
        timeout: 4000,
      });
    },
    onError: (mutationError, _blockedUserId, context) => {
      if (context?.previous != null) {
        queryClient.setQueryData(blockedAccountsQueryKeys.me(), context.previous);
      }

      toast.add({
        type: "error",
        title: "Could not unblock account",
        description: getApiErrorMessage(mutationError),
        timeout: 4000,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: blockedAccountsQueryKeys.me(),
      });
    },
  });

  const accounts = data?.items ?? initialBlocked?.items ?? null;
  const pendingLabel = pendingUnblock != null ? displayNameFor(pendingUnblock) : "";

  if (accounts == null) {
    if (isError) {
      return (
        <p className="text-sm text-destructive" role="alert">
          {getApiErrorMessage(error)}
        </p>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading blocked accounts…
      </div>
    );
  }

  return (
    <>
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
                <p className="text-sm font-medium">{displayNameFor(account)}</p>

                <p className="text-xs text-muted-foreground">
                  @{account.username} · {formatBlockedAt(account.blocked_at)}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPendingUnblock(account);
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

      <Dialog
        open={pendingUnblock != null}
        onOpenChange={(open) => {
          if (!open && !unblockMutation.isPending) {
            setPendingUnblock(null);
          }
        }}
      >
        <DialogContent className="max-w-md gap-0">
          <div className="px-5 py-4">
            <DialogTitle className="text-lg font-semibold">Unblock this account?</DialogTitle>

            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {pendingLabel.length > 0
                ? `${pendingLabel} will be able to interact with you again.`
                : "This account will be able to interact with you again."}
            </DialogDescription>
          </div>

          <DialogFooter className="items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              disabled={unblockMutation.isPending}
              onClick={() => {
                setPendingUnblock(null);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={unblockMutation.isPending || pendingUnblock == null}
              onClick={() => {
                if (pendingUnblock == null) {
                  return;
                }

                unblockMutation.mutate(pendingUnblock.id);
              }}
            >
              Unblock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
