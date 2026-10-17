import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { getApiErrorMessage } from "@/libs/auth";
import {
  blockUser,
  blockedAccountsQueryKeys,
  myBlockedAccountsQueryOptions,
  unblockUser,
} from "@/queries/blocked-accounts";
import type { BlockedAccountListResponse } from "@/queries/blocked-accounts";

type BlockUserButtonProps = {
  username: string;
  displayName: string;
};

export function BlockUserButton({ username, displayName }: BlockUserButtonProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const blockedQuery = useQuery(myBlockedAccountsQueryOptions());
  const blockedEntry = blockedQuery.data?.items.find((item) => item.username === username);
  const isBlocked = blockedEntry != null;
  const label = displayName.trim().length > 0 ? displayName : username;

  const blockMutation = useMutation({
    mutationFn: () => blockUser({ username }),
    onSuccess: (item) => {
      queryClient.setQueryData<BlockedAccountListResponse>(blockedAccountsQueryKeys.me(), (current) => {
        const items = current?.items ?? [];
        const exists = items.some((row) => row.id === item.id);

        if (exists) {
          return {
            items,
            total: items.length,
          };
        }

        const nextItems = [item, ...items];

        return {
          items: nextItems,
          total: nextItems.length,
        };
      });

      setDialogOpen(false);

      toast.add({
        type: "success",
        title: "Account blocked",
        description: `${label} can no longer interact with you.`,
        timeout: 4000,
      });
    },
    onError: (mutationError) => {
      toast.add({
        type: "error",
        title: "Could not block account",
        description: getApiErrorMessage(mutationError),
        timeout: 4000,
      });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => {
      if (blockedEntry == null) {
        return Promise.resolve();
      }

      return unblockUser(blockedEntry.id);
    },
    onSuccess: () => {
      queryClient.setQueryData<BlockedAccountListResponse>(blockedAccountsQueryKeys.me(), (current) => {
        if (current == null) {
          return current;
        }

        const items = current.items.filter((row) => row.username !== username);

        return {
          items,
          total: items.length,
        };
      });

      setDialogOpen(false);

      toast.add({
        type: "success",
        title: "Account unblocked",
        description: `${label} can interact with you again.`,
        timeout: 4000,
      });
    },
    onError: (mutationError) => {
      toast.add({
        type: "error",
        title: "Could not unblock account",
        description: getApiErrorMessage(mutationError),
        timeout: 4000,
      });
    },
  });

  const isPending = blockMutation.isPending || unblockMutation.isPending;

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={blockedQuery.isPending}
        onClick={() => {
          setDialogOpen(true);
        }}
      >
        {isBlocked ? "Unblock" : "Block"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md gap-0">
          <div className="px-5 py-4">
            <DialogTitle className="text-lg font-semibold">
              {isBlocked ? "Unblock this account?" : "Block this account?"}
            </DialogTitle>

            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {isBlocked
                ? `${label} will be able to interact with you again.`
                : `${label} will no longer be able to interact with you. You can unblock them later from blocked accounts.`}
            </DialogDescription>
          </div>

          <DialogFooter className="items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setDialogOpen(false);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (isBlocked) {
                  unblockMutation.mutate();

                  return;
                }

                blockMutation.mutate();
              }}
            >
              {isBlocked ? "Unblock" : "Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
