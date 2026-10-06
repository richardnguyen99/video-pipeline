import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { RemoveFromHistoryDialog } from "@/layouts/user-profile/videos/remove-from-history-dialog";
import { WatchedCard } from "@/layouts/user-profile/videos/watched-card";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { getApiErrorMessage } from "@/libs/auth";
import {
  removeWatchedVideo,
  watchedVideoQueryKeys,
  watchedVideosInfiniteQueryOptions,
  WATCHED_HISTORY_PAGE_SIZE,
} from "@/queries/video-watch";

type HistoryPageProps = {
  enabled: boolean;
};

export function HistoryPage({ enabled }: HistoryPageProps) {
  const queryClient = useQueryClient();
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, status } = useInfiniteQuery({
    ...watchedVideosInfiniteQueryOptions({
      limit: WATCHED_HISTORY_PAGE_SIZE,
    }),
    enabled,
  });

  const removeMutation = useMutation({
    mutationFn: removeWatchedVideo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: watchedVideoQueryKeys.all,
      });
      setPendingRemoveId(null);
      toast.add({
        type: "success",
        title: "Removed from history",
        timeout: 3000,
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

  useEffect(() => {
    const node = sentinelRef.current;

    if (node == null || !enabled) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          if (!hasNextPage || isFetchingNextPage) {
            return;
          }

          void fetchNextPage();
          return;
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [enabled, fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (enabled && status === "pending") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <WatchedCardSkeleton key={index} index={index} />
        ))}
      </div>
    );
  }

  const items = status === "success" ? data.pages.flatMap((page) => page.items) : [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Videos you watch will show up here.</p>;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((video) => (
          <WatchedCard
            key={video.id}
            video={video}
            onRemoveFromHistory={(videoId) => {
              setPendingRemoveId(videoId);
            }}
          />
        ))}
      </div>

      <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

      {isFetchingNextPage ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <WatchedCardSkeleton key={`more-${index}`} index={index} />
          ))}
        </div>
      ) : null}

      <RemoveFromHistoryDialog
        open={pendingRemoveId != null}
        isPending={removeMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) {
            setPendingRemoveId(null);
          }
        }}
        onConfirm={() => {
          if (pendingRemoveId == null) {
            return;
          }

          removeMutation.mutate(pendingRemoveId);
        }}
      />
    </>
  );
}
