import { ActressBanner } from "@/layouts/single-actress/actress-banner";
import { ActressVideos } from "@/layouts/single-actress/actress-videos";
import type { ActressVideoFilters, ActressVideoSort } from "@/libs/actress-videos";
import type { ActressSummary } from "@/libs/actresses";
import type { Video } from "@/mocks/videos";

interface ActressDetailProps {
  actress: ActressSummary;
  videos: Video[];
  total: number;
  page: number;
  totalPages: number;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
  allVideos: Video[];
}

export function ActressDetail({
  actress,
  videos,
  total,
  page,
  totalPages,
  sort,
  filters,
  allVideos,
}: ActressDetailProps) {
  return (
    <div className="min-h-screen">
      <ActressBanner actress={actress} />
      <ActressVideos
        videos={videos}
        total={total}
        page={page}
        totalPages={totalPages}
        sort={sort}
        filters={filters}
        allVideos={allVideos}
      />
    </div>
  );
}
