import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { RemoveFromHistoryDialog } from "@/layouts/user-profile/videos/remove-from-history-dialog";
import { WatchedCard } from "@/layouts/user-profile/videos/watched-card";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { getApiErrorMessage } from "@/libs/auth";
import { removeWatchedVideo, watchedVideoQueryKeys } from "@/queries/video-watch";
import type { WatchedVideo } from "@/queries/video-watch";

type WatchedSectionProps = {
  videos: Array<WatchedVideo>;
  isLoading: boolean;
};

export function WatchedSection({ videos, isLoading }: WatchedSectionProps) {
  const queryClient = useQueryClient();
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);

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

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <WatchedCardSkeleton index={0} />

        <WatchedCardSkeleton index={1} />

        <WatchedCardSkeleton index={2} />
      </div>
    );
  }

  if (videos.length === 0) {
    return <p className="text-sm text-muted-foreground">Videos you watch will show up here.</p>;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <WatchedCard
            key={video.id}
            video={video}
            onRemoveFromHistory={(videoId) => {
              setPendingRemoveId(videoId);
            }}
          />
        ))}
      </div>

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
