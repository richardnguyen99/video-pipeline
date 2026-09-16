import { Suspense, useState } from "react";
import { SidebarSkeleton } from "@/components/video/sidebar-skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { VideoSidebarCard } from "@/components/video/video-sidebar-card";
import type { Video } from "@/mocks/videos";
import {
  DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT,
  VIDEO_RECOMMENDATIONS_EXPANDED_LIMIT,
  videoRecommendationsQueryOptions,
} from "@/queries/videos";

interface VideoSidebarProps {
  videoId: string;
  videos: Video[];
}

const MORE_SKELETON_COUNT = 4;

function sidebarCardBadge(index: number): "recommended" | "new" | undefined {
  if (index === 0) {
    return "recommended";
  }

  if (index < 3) {
    return "new";
  }

  return undefined;
}

function SidebarCardList({ videos, startIndex = 0 }: { videos: Video[]; startIndex?: number }) {
  return (
    <>
      {videos.map((video, index) => {
        const absoluteIndex = startIndex + index;

        return (
          <VideoSidebarCard
            key={`${video.id}-${video.video_id}`}
            video={video}
            views={video.views ?? 0}
            likes={video.likes ?? 0}
            comments={typeof video.comments === "number" ? video.comments : (video.comments?.length ?? 0)}
            badge={sidebarCardBadge(absoluteIndex)}
          />
        );
      })}
    </>
  );
}

function VideoSidebarMore({ videoId }: { videoId: string }) {
  const { data } = useSuspenseQuery(videoRecommendationsQueryOptions(videoId, VIDEO_RECOMMENDATIONS_EXPANDED_LIMIT));
  const more = data.slice(DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT);

  if (more.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <SidebarCardList videos={more} startIndex={DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT} />
    </div>
  );
}

export function VideoSidebar({ videoId, videos }: VideoSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const items = videos.slice(0, DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT);
  const canLoadMore = videos.length >= DEFAULT_VIDEO_RECOMMENDATIONS_LIMIT;

  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="hidden w-full shrink-0 lg:block lg:w-90 xl:w-100" aria-label="Related videos">
      <div className="flex flex-col gap-4">
        <SidebarCardList videos={items} />

        {expanded ? (
          <Suspense
            fallback={
              <div aria-busy="true" aria-label="Loading more related videos">
                {Array.from({ length: MORE_SKELETON_COUNT }, (_, index) => (
                  <SidebarSkeleton key={index} />
                ))}
              </div>
            }
          >
            <VideoSidebarMore videoId={videoId} />
          </Suspense>
        ) : null}

        {!expanded && canLoadMore ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setExpanded(true);
            }}
          >
            Load more
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
