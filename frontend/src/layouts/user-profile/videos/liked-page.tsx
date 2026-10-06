import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { LikedCard } from "@/layouts/user-profile/videos/liked-card";
import { RemoveFromLikedDialog } from "@/layouts/user-profile/videos/remove-from-liked-dialog";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { getApiErrorMessage } from "@/libs/auth";
import {
  clearVideoReaction,
  LIKED_PAGE_SIZE,
  likedVideosInfiniteQueryOptions,
  videoReactionQueryKeys,
} from "@/queries/video-reaction";

type LikedPageProps = {
  enabled: boolean;
};

export function LikedPage({ enabled }: LikedPageProps) {
  const queryClient = useQueryClient();
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, status } = useInfiniteQuery({
    ...likedVideosInfiniteQueryOptions({
      limit: LIKED_PAGE_SIZE,
    }),
    enabled,
  });

  const removeMutation = useMutation({
    mutationFn: (videoId: number) => clearVideoReaction(videoId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: videoReactionQueryKeys.all,
      });
      setPendingRemoveId(null);
      toast.add({
        type: "success",
        title: "Removed from liked",
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
    return <p className="text-sm text-muted-foreground">Videos you like will show up here.</p>;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((video) => (
          <LikedCard
            key={video.id}
            video={video}
            onRemoveFromLiked={(videoId) => {
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

      <RemoveFromLikedDialog
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
