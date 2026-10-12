import { Link } from "@tanstack/react-router";
import { Clapperboard, Eye, MessageCircle, ThumbsUp, UserPlus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { SubscriptionRowMenu } from "@/layouts/user-profile/subscriptions/row-menu";
import { formatCompactNumber } from "@/libs/utils";
import type { ActressSubscription } from "@/queries/actress-subscribe";

type SubscriptionRowProps = {
  subscription: ActressSubscription;
  isOwner: boolean;
  engagementLoading?: boolean;
  onUnsubscribe?: (actressId: number) => void;
};

export function SubscriptionRow({
  subscription,
  isOwner,
  engagementLoading = false,
  onUnsubscribe,
}: SubscriptionRowProps) {
  const metaParts: Array<string> = [];

  if (subscription.age != null) {
    metaParts.push(String(subscription.age));
  }

  if (subscription.measurementLabel) {
    metaParts.push(subscription.measurementLabel);
  }

  const metaLabel = metaParts.join(" · ");

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/30">
      <Link
        to="/actresses/$actressId"
        params={{ actressId: String(subscription.actressId) }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="size-9 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted ring-1 ring-border/40 transition-shadow group-hover:ring-primary/30">
          {subscription.imageUrl ? (
            <img
              src={subscription.imageUrl}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
              {subscription.name.slice(0, 1)}
            </span>
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="line-clamp-1 text-sm">
            <span className="font-semibold text-foreground">{subscription.name}</span>

            {metaLabel ? <span className="font-normal text-muted-foreground"> - {metaLabel}</span> : null}
          </p>

          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground"
            aria-busy={engagementLoading || undefined}
          >
            {engagementLoading ? (
              <>
                <span className="sr-only">Loading engagement</span>

                <Skeleton className="h-4 w-1/2" />
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1" title="Videos">
                  <Clapperboard className="size-3.5 shrink-0" aria-hidden />

                  <span className="sr-only">Videos</span>

                  {formatCompactNumber(subscription.videoCount)}
                </span>

                <span className="inline-flex items-center gap-1" title="Views">
                  <Eye className="size-3.5 shrink-0" aria-hidden />

                  <span className="sr-only">Views</span>

                  {formatCompactNumber(subscription.viewCount)}
                </span>

                <span className="inline-flex items-center gap-1" title="Subscribers">
                  <UserPlus className="size-3.5 shrink-0" aria-hidden />

                  <span className="sr-only">Subscribers</span>

                  {formatCompactNumber(subscription.subscriberCount)}
                </span>

                <span className="inline-flex items-center gap-1" title="Likes">
                  <ThumbsUp className="size-3.5 shrink-0" aria-hidden />

                  <span className="sr-only">Likes</span>

                  {formatCompactNumber(subscription.likeCount)}
                </span>

                <span className="inline-flex items-center gap-1" title="Comments">
                  <MessageCircle className="size-3.5 shrink-0" aria-hidden />

                  <span className="sr-only">Comments</span>

                  {formatCompactNumber(subscription.commentCount)}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      {isOwner ? <SubscriptionRowMenu actressId={subscription.actressId} onUnsubscribe={onUnsubscribe} /> : null}
    </div>
  );
}
