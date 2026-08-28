import React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ActressBanner } from "@/layouts/single-actress/actress-banner";
import { ActressVideosGrid, ActressVideosShell } from "@/layouts/single-actress/actress-videos";
import { ActressVideosGridSkeleton } from "@/layouts/single-actress/actress-videos-skeleton";
import type { ActressVideoFilters, ActressVideoSort } from "@/libs/actress-videos";
import type { ActressSummary } from "@/libs/actresses";
import type { VideoListPage } from "@/queries/videos";

interface ActressDetailProps {
  actress: ActressSummary;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
  pagePromise: Promise<VideoListPage>;
}

export function ActressDetail({ actress, sort, filters, pagePromise }: ActressDetailProps) {
  return (
    <div className="min-h-screen">
      <ActressBanner actress={actress} />

      <ActressVideosShell sort={sort} filters={filters}>
        <React.Suspense
          fallback={
            <>
              <div className="mb-6 flex h-5 items-center">
                <Skeleton className="h-4 w-24" />
              </div>
              <ActressVideosGridSkeleton />
            </>
          }
        >
          <ActressVideosDeferred pagePromise={pagePromise} sort={sort} filters={filters} />
        </React.Suspense>
      </ActressVideosShell>
    </div>
  );
}

function ActressVideosDeferred({
  pagePromise,
  sort,
  filters,
}: {
  pagePromise: Promise<VideoListPage>;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
}) {
  const data = React.use(pagePromise);

  return (
    <>
      <p className="mb-6 flex h-5 items-center text-sm text-muted-foreground sm:text-base">
        {data.total} {data.total === 1 ? "video" : "videos"}
      </p>
      <ActressVideosGrid
        videos={data.videos}
        total={data.total}
        page={data.page}
        totalPages={data.totalPages}
        sort={sort}
        filters={filters}
      />
    </>
  );
}
