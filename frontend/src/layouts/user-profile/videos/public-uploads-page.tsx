import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { PublicUploadsSection } from "@/layouts/user-profile/videos/public-uploads-section";
import { WatchedCardSkeleton } from "@/layouts/user-profile/videos/watched-card-skeleton";
import { PUBLIC_USER_VIDEOS_PAGE_SIZE, userVideosInfiniteQueryOptions } from "@/queries/user-profile";

type PublicUploadsPageProps = {
  username: string;
  isOwner: boolean;
  enabled?: boolean;
};

export function PublicUploadsPage({ username, isOwner, enabled = true }: PublicUploadsPageProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, status } = useInfiniteQuery({
    ...userVideosInfiniteQueryOptions(username, {
      limit: PUBLIC_USER_VIDEOS_PAGE_SIZE,
    }),
    enabled,
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

  return (
    <>
      <PublicUploadsSection videos={items} isLoading={false} isOwner={isOwner} />

      <div ref={sentinelRef} className="h-4 w-full" aria-hidden />

      {isFetchingNextPage ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <WatchedCardSkeleton index={0} />

          <WatchedCardSkeleton index={1} />

          <WatchedCardSkeleton index={2} />
        </div>
      ) : null}
    </>
  );
}
