import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/toast";
import { getApiErrorMessage } from "@/libs/auth";
import {
  addPlaylistShare,
  playlistQueryKeys,
  playlistSharesQueryOptions,
  removePlaylistShare,
} from "@/queries/playlist";
import type { PlaylistVisibility } from "@/queries/playlist";
import { userSearchQueryOptions } from "@/queries/users";

type SharePlaylistDialogProps = {
  open: boolean;
  playlistId: string;
  visibility: PlaylistVisibility;
  onOpenChange: (open: boolean) => void;
};

export function SharePlaylistDialog({ open, playlistId, visibility, onOpenChange }: SharePlaylistDialogProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const isRestricted = visibility === "restricted";

  const sharesQuery = useQuery({
    ...playlistSharesQueryOptions(playlistId),
    enabled: open && isRestricted,
  });

  const searchQuery = useQuery({
    ...userSearchQueryOptions(trimmedQuery, { limit: 8 }),
    enabled: open && isRestricted && trimmedQuery.length >= 1,
  });

  const shares = useMemo(() => sharesQuery.data?.items ?? [], [sharesQuery.data?.items]);
  const sharedUserIds = useMemo(() => new Set(shares.map((item) => item.user_id)), [shares]);

  const suggestions = useMemo(() => {
    const items = searchQuery.data?.items ?? [];

    return items.filter((item) => !sharedUserIds.has(item.id));
  }, [searchQuery.data?.items, sharedUserIds]);

  const addMutation = useMutation({
    mutationFn: (username: string) => addPlaylistShare(playlistId, username),
    onSuccess: async () => {
      setQuery("");
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.shares(playlistId),
      });
      toast.add({
        type: "success",
        title: "User shared",
        timeout: 2500,
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removePlaylistShare(playlistId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: playlistQueryKeys.shares(playlistId),
      });
      toast.add({
        type: "success",
        title: "Share removed",
        timeout: 2500,
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
  });

  const isBusy = addMutation.isPending || removeMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isBusy) {
          return;
        }

        if (!next) {
          setQuery("");
        }

        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0">
        <div className="px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Share playlist</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            {isRestricted
              ? "Search by username or email to grant view access."
              : "Set visibility to Restricted before sharing with specific users."}
          </DialogDescription>
        </div>

        {isRestricted ? (
          <div className="flex flex-col gap-3 px-5 pb-4">
            <Label htmlFor="share-playlist-search">People</Label>

            <Input
              id="share-playlist-search"
              value={query}
              disabled={isBusy}
              autoComplete="off"
              placeholder="Search username or email…"
              className="bg-input/30"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />

            {shares.length > 0 ? (
              <div
                className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-input/30 px-2.5 py-2"
                aria-label="Shared users"
              >
                {shares.map((share) => (
                  <Badge key={share.user_id} variant="secondary" className="gap-1 bg-muted pr-1">
                    {share.display_name ?? share.username}

                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-background/60"
                      aria-label={`Remove ${share.username}`}
                      disabled={isBusy}
                      onClick={() => {
                        removeMutation.mutate(share.user_id);
                      }}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}

            <ScrollArea className="h-48 rounded-lg border border-border bg-input/30">
              {trimmedQuery.length < 1 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Type a username or email to find people.</p>
              ) : searchQuery.isPending ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
              ) : suggestions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No users found.</p>
              ) : (
                <ul className="py-1">
                  {suggestions.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                        disabled={isBusy}
                        onClick={() => {
                          addMutation.mutate(user.username);
                        }}
                      >
                        <span className="font-medium text-foreground">{user.display_name ?? user.username}</span>

                        <span className="text-xs text-muted-foreground">
                          @{user.username} · {user.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        ) : null}

        <DialogFooter className="border-t border-border px-5 py-3">
          <div className="flex w-full justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
