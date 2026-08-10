import { Skeleton } from "@/components/ui/skeleton";
import { ACTRESS_VIDEO_PAGE_SIZE } from "@/libs/actress-videos";

export function ActressVideosGridSkeleton() {
  return (
    <>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: ACTRESS_VIDEO_PAGE_SIZE }).map((_, i) => (
          <li key={i} className="min-w-0">
            <Skeleton className="aspect-video w-full rounded-2xl" />
          </li>
        ))}
      </ul>
      <div className="mt-10 flex items-center justify-center gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </>
  );
}
