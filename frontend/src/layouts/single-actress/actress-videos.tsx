import { CategoryVideoCard } from "@/components/video/category-video-card";
import { ActressVideosToolbar } from "@/layouts/single-actress/actress-videos-toolbar";
import type { ActressVideoFilters, ActressVideoSort } from "@/libs/actress-videos";
import type { Video } from "@/mocks/videos";
import { cn } from "@/libs/utils";

interface ActressVideosProps {
  videos: Video[];
  total: number;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
  allVideos: Video[];
  className?: string;
}

export function ActressVideos({ videos, total, sort, filters, allVideos, className }: ActressVideosProps) {
  return (
    <section className={cn("mx-auto w-full px-6 py-10 sm:px-10 lg:px-16", className)}>
      <header className="mb-6">
        <h2 className="text-pretty text-2xl font-semibold tracking-tight sm:text-3xl">Featured videos</h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {total} {total === 1 ? "video" : "videos"}
        </p>
      </header>

      <ActressVideosToolbar sort={sort} filters={filters} allVideos={allVideos} />

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No videos match these filters.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <li key={video.video_id} className="min-w-0">
              <CategoryVideoCard video={video} variant="grid" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
