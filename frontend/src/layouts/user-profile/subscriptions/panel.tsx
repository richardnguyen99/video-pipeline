import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { SubscriptionRow } from "@/layouts/user-profile/subscriptions/row";
import { actressSubscribeQueryKeys, unsubscribeFromActress } from "@/queries/actress-subscribe";
import type { ActressSubscription } from "@/queries/actress-subscribe";

type SubscriptionsPanelProps = {
  username: string;
  subscriptions: Array<ActressSubscription>;
  isOwner: boolean;
};

export function SubscriptionsPanel({ username, subscriptions, isOwner }: SubscriptionsPanelProps) {
  const queryClient = useQueryClient();

  const unsubscribeMutation = useMutation({
    mutationFn: (actressId: number) => unsubscribeFromActress(actressId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: actressSubscribeQueryKeys.byUsername(username),
      });
      await queryClient.invalidateQueries({
        queryKey: actressSubscribeQueryKeys.me(),
      });
      toast.add({
        type: "success",
        title: "Unsubscribed",
        timeout: 3000,
      });
    },
    onError: () => {
      toast.add({
        type: "error",
        title: "Could not unsubscribe",
        timeout: 4000,
      });
    },
  });

  return (
    <SettingsCard title="Subscriptions" description="Actresses you follow so you do not miss their new videos.">
      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isOwner ? "You have not subscribed to any actresses yet." : "No public subscriptions to show."}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {subscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.actressId}
              subscription={subscription}
              isOwner={isOwner}
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
