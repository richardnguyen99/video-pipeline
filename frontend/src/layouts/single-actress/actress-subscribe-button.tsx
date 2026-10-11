import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { UserProfile } from "@/libs/auth";
import { getApiErrorMessage } from "@/libs/auth";
import { cn } from "@/libs/utils";
import {
  actressSubscribeQueryKeys,
  actressSubscribeStatusQueryOptions,
  subscribeToActress,
  unsubscribeFromActress,
  type ActressSubscribeStatusApi,
} from "@/queries/actress-subscribe";
import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

type ActressSubscribeButtonProps = {
  actressId: number;
  initialSubCount?: number;
  className?: string;
};

function isRealUser(user: UserProfile | null | undefined): boolean {
  return user != null && user.id !== "";
}

export function ActressSubscribeButton({ actressId, initialSubCount = 0, className }: ActressSubscribeButtonProps) {
  const queryClient = useQueryClient();
  const storeUser = useAuthStore((state) => state.user);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const cachedUser = queryClient.getQueryData<UserProfile | null>(authMeQueryOptions.queryKey) ?? null;
  const user = isRealUser(storeUser) ? storeUser : (cachedUser ?? storeUser);
  const isFullyAuthenticated = isRealUser(user);
  const isIdentityHint = user != null && user.id === "";

  const cachedStatus = queryClient.getQueryData<ActressSubscribeStatusApi>(actressSubscribeQueryKeys.status(actressId));

  const statusQuery = useQuery({
    ...actressSubscribeStatusQueryOptions(actressId),
    enabled: isFullyAuthenticated && !isRestoring,
    initialData: cachedStatus,
  });

  const status = statusQuery.data ?? cachedStatus;
  const isStatusResolved = status != null;
  const isSubscribed = status?.is_subscribed === true;

  const mutation = useMutation({
    mutationFn: async (nextSubscribed: boolean) => {
      if (nextSubscribed) {
        return subscribeToActress(actressId);
      }

      return unsubscribeFromActress(actressId);
    },
    onMutate: async (nextSubscribed) => {
      await queryClient.cancelQueries({
        queryKey: actressSubscribeQueryKeys.status(actressId),
      });

      const previous = queryClient.getQueryData<ActressSubscribeStatusApi>(actressSubscribeQueryKeys.status(actressId));

      const baseCount = previous?.sub_cnt ?? initialSubCount;
      const wasSubscribed = previous?.is_subscribed === true;

      let nextCount = baseCount;

      if (nextSubscribed && !wasSubscribed) {
        nextCount = baseCount + 1;
      } else if (!nextSubscribed && wasSubscribed) {
        nextCount = Math.max(0, baseCount - 1);
      }

      const optimistic: ActressSubscribeStatusApi = {
        actress_id: actressId,
        is_subscribed: nextSubscribed,
        sub_cnt: nextCount,
      };

      queryClient.setQueryData(actressSubscribeQueryKeys.status(actressId), optimistic);

      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous != null) {
        queryClient.setQueryData(actressSubscribeQueryKeys.status(actressId), context.previous);
      } else {
        queryClient.removeQueries({
          queryKey: actressSubscribeQueryKeys.status(actressId),
        });
      }

      toast.add({
        type: "error",
        title: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(actressSubscribeQueryKeys.status(actressId), data);

      void queryClient.invalidateQueries({
        queryKey: actressSubscribeQueryKeys.me(),
      });
      void queryClient.invalidateQueries({
        queryKey: [...actressSubscribeQueryKeys.all, "user"],
      });
    },
  });

  const pending = mutation.isPending;
  const isServer = typeof window === "undefined";

  /**
   * Prefer SSR/dehydrated status when present so the first paint matches HTML.
   * On the client, hold a neutral state while session bootstrap runs — never
   * flash the guest "Subscribe" label for an authenticated session.
   */
  const isResolving = (!isServer && isRestoring) || isIdentityHint || (isFullyAuthenticated && !isStatusResolved);

  function handleClick() {
    if (!isFullyAuthenticated || isResolving || pending || !isStatusResolved) {
      return;
    }

    mutation.mutate(!isSubscribed);
  }

  if (isResolving) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn("w-fit max-w-48", className)}
        disabled
        aria-busy="true"
        aria-label="Loading subscription status"
      >
        <UserPlus className="size-3.5 shrink-0 xs:size-4" />

        <span className="line-clamp-1 opacity-0">Subscribed</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={isSubscribed ? "secondary" : "default"}
      size="sm"
      className={cn("w-fit max-w-48", className)}
      disabled={!isFullyAuthenticated || pending}
      title={isFullyAuthenticated ? undefined : "Log in to subscribe"}
      onClick={handleClick}
    >
      <UserPlus className="size-3.5 shrink-0 xs:size-4" />

      <span className="line-clamp-1">{isSubscribed ? "Subscribed" : "Subscribe"}</span>
    </Button>
  );
}
