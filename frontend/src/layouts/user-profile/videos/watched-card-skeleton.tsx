import { Skeleton } from "@/components/ui/skeleton";

type WatchedCardSkeletonProps = {
  index: number;
};

export function WatchedCardSkeleton({ index }: WatchedCardSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40" data-skeleton-index={index}>
      <Skeleton className="aspect-video w-full rounded-none" />

      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-24" />

        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
