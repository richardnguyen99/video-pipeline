import { useState } from "react";

import { RemoveFromHistoryDialog } from "@/layouts/user-profile/videos/remove-from-history-dialog";
import { WatchedCard } from "@/layouts/user-profile/videos/watched-card";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import type { WatchedVideo } from "@/queries/video-watch";

type WatchedSectionProps = {
  videos: Array<WatchedVideo>;
  isLoading: boolean;
};

export function WatchedSection({ videos, isLoading }: WatchedSectionProps) {
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);

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
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemoveId(null);
          }
        }}
        onConfirm={() => {
          setPendingRemoveId(null);
        }}
      />
    </>
  );
}
