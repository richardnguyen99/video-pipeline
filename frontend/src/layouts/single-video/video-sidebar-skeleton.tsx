import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_COUNT = 6;

export function VideoSidebarSkeleton() {
  return (
    <aside
      className="hidden w-full shrink-0 lg:block lg:w-90 xl:w-100"
      aria-label="Loading related videos"
      aria-busy="true"
    >
      <div className="flex flex-col gap-4">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="aspect-video w-40 shrink-0 rounded-lg sm:w-44" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
