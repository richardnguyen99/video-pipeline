import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
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
} from "@/queries/actress-subscribe";
import type { ActressSubscribeStatusApi } from "@/queries/actress-subscribe";
import { patchActressSubscriberCount } from "@/queries/actresses";
import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";

type ActressSubscribeButtonProps = {
  actressId: number;
  initialSubCount?: number;
  /** SSR/loader status — same transport path as route auth for the header. */
  initialStatus?: ActressSubscribeStatusApi | null;
  className?: string;
};

function isRealUser(user: UserProfile | null | undefined): boolean {
  return user != null && user.id !== "";
}

export function ActressSubscribeButton({
  actressId,
  initialSubCount = 0,
  initialStatus = null,
  className,
}: ActressSubscribeButtonProps) {
  const queryClient = useQueryClient();
  const storeUser = useAuthStore((state) => state.user);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const routeAuth = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.auth,
  });

  const cachedUser = queryClient.getQueryData<UserProfile | null>(authMeQueryOptions.queryKey) ?? null;

  const user = (() => {
    if (isRealUser(storeUser)) {
      return storeUser;
    }

    if (isRealUser(routeAuth.user)) {
      return routeAuth.user;
    }

    if (isRealUser(cachedUser)) {
      return cachedUser;
    }

    return storeUser ?? routeAuth.user ?? cachedUser ?? null;
  })();

  const isFullyAuthenticated = isRealUser(user);
  const isIdentityHint = user != null && user.id === "";

  const cachedStatus = queryClient.getQueryData<ActressSubscribeStatusApi>(actressSubscribeQueryKeys.status(actressId));

  const resolvedInitial = cachedStatus ?? initialStatus ?? undefined;

  const statusQuery = useQuery({
    ...actressSubscribeStatusQueryOptions(actressId),
    enabled: isFullyAuthenticated && !isRestoring,
    initialData: resolvedInitial,
  });

  const status = statusQuery.data ?? resolvedInitial ?? null;
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
      patchActressSubscriberCount(queryClient, actressId, nextCount);

      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous != null) {
        queryClient.setQueryData(actressSubscribeQueryKeys.status(actressId), context.previous);
        patchActressSubscriberCount(queryClient, actressId, context.previous.sub_cnt);
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
      patchActressSubscriberCount(queryClient, actressId, data.sub_cnt);

      void queryClient.invalidateQueries({
        queryKey: actressSubscribeQueryKeys.me(),
      });
      void queryClient.invalidateQueries({
        queryKey: [...actressSubscribeQueryKeys.all, "user"],
      });

      toast.add({
        type: "success",
        title: data.is_subscribed ? "Subscribed" : "Unsubscribed",
        timeout: 3000,
      });
    },
  });

  const pending = mutation.isPending;

  /**
   * Loader ``initialStatus`` is serialized with the route (same path as header
   * auth). When present, paint immediately. Hold a neutral state only while a
   * real or pending session may still produce a status — never for a known guest.
   */
  const mayBeAuthenticated = isFullyAuthenticated || isIdentityHint || (isRestoring && routeAuth.isAuthenticated);
  const isResolving = !isStatusResolved && mayBeAuthenticated;

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
