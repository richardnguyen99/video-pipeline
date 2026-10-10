import { Link } from "@tanstack/react-router";
import { Eye, ThumbsUp } from "lucide-react";

import { SubscriptionRowMenu } from "@/layouts/user-profile/subscriptions/row-menu";
import { formatCompactNumber } from "@/libs/utils";
import type { ActressSubscription } from "@/queries/actress-subscribe";

type SubscriptionRowProps = {
  subscription: ActressSubscription;
  isOwner: boolean;
  onUnsubscribe?: (actressId: number) => void;
};

export function SubscriptionRow({ subscription, isOwner, onUnsubscribe }: SubscriptionRowProps) {
  const metaParts: Array<string> = [];

  if (subscription.age != null) {
    metaParts.push(String(subscription.age));
  }

  if (subscription.measurementLabel) {
    metaParts.push(subscription.measurementLabel);
  }

  const metaLabel = metaParts.join(" · ");

  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-2">
      <Link
        to="/actresses/$actressId"
        params={{ actressId: String(subscription.actressId) }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="size-9 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted">
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
            <span className="font-semibold">{subscription.name}</span>

            {metaLabel ? <span className="font-normal text-muted-foreground"> - {metaLabel}</span> : null}
          </p>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5 shrink-0" aria-hidden />

              <span className="sr-only">Views</span>

              {formatCompactNumber(subscription.viewCount)}
            </span>

            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="size-3.5 shrink-0" aria-hidden />

              <span className="sr-only">Likes</span>

              {formatCompactNumber(subscription.likeCount)}
            </span>
          </div>
        </div>
      </Link>

      {isOwner ? <SubscriptionRowMenu actressId={subscription.actressId} onUnsubscribe={onUnsubscribe} /> : null}
    </div>
  );
}
