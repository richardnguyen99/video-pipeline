import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { SubscriptionRow } from "@/layouts/user-profile/subscriptions/row";
import {
  actressSubscribeQueryKeys,
  mergeSubscriptionEngagement,
  unsubscribeFromActress,
  userActressSubscriptionsQueryOptions,
} from "@/queries/actress-subscribe";
import type { ActressSubscription } from "@/queries/actress-subscribe";
import { actressEngagementQueryOptions } from "@/queries/actresses";

type SubscriptionsPanelProps = {
  username: string;
  subscriptions: Array<ActressSubscription>;
  isOwner: boolean;
};

export function SubscriptionsPanel({
  username,
  subscriptions: initialSubscriptions,
  isOwner,
}: SubscriptionsPanelProps) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    ...userActressSubscriptionsQueryOptions(username),
    initialData: initialSubscriptions,
  });

  const subscriptions = listQuery.data;

  const actressIds = useMemo(() => subscriptions.map((item) => item.actressId), [subscriptions]);

  const engagementQuery = useQuery(actressEngagementQueryOptions(actressIds));
  const engagementLoading = actressIds.length > 0 && engagementQuery.data == null && engagementQuery.isFetching;

  const displaySubscriptions = useMemo(
    () => mergeSubscriptionEngagement(subscriptions, engagementQuery.data),
    [subscriptions, engagementQuery.data],
  );

  const unsubscribeMutation = useMutation({
    mutationFn: (actressId: number) => unsubscribeFromActress(actressId),
    onMutate: async (actressId) => {
      await queryClient.cancelQueries({
        queryKey: actressSubscribeQueryKeys.byUsername(username),
      });

      const previous = queryClient.getQueryData<Array<ActressSubscription>>(
        actressSubscribeQueryKeys.byUsername(username),
      );

      queryClient.setQueryData<Array<ActressSubscription>>(actressSubscribeQueryKeys.byUsername(username), (current) =>
        (current ?? initialSubscriptions).filter((item) => item.actressId !== actressId),
      );

      return { previous };
    },
    onError: (_error, _actressId, context) => {
      if (context?.previous != null) {
        queryClient.setQueryData(actressSubscribeQueryKeys.byUsername(username), context.previous);
      }

      toast.add({
        type: "error",
        title: "Could not unsubscribe",
        timeout: 4000,
      });
    },
    onSuccess: async (_data, actressId) => {
      await queryClient.invalidateQueries({
        queryKey: actressSubscribeQueryKeys.byUsername(username),
      });
      await queryClient.invalidateQueries({
        queryKey: actressSubscribeQueryKeys.me(),
      });
      await queryClient.invalidateQueries({
        queryKey: actressSubscribeQueryKeys.status(actressId),
      });

      toast.add({
        type: "success",
        title: "Unsubscribed",
        timeout: 3000,
      });
    },
  });

  return (
    <SettingsCard title="Subscriptions" description="Actresses you follow so you do not miss their new videos.">
      {displaySubscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isOwner ? "You have not subscribed to any actresses yet." : "No public subscriptions to show."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {displaySubscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.actressId}
              subscription={subscription}
              isOwner={isOwner}
              engagementLoading={engagementLoading}
              onUnsubscribe={(actressId) => {
                unsubscribeMutation.mutate(actressId);
              }}
            />
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
