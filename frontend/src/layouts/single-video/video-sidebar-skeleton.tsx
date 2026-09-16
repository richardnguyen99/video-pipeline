import { SidebarSkeleton } from "@/components/video/sidebar-skeleton";

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
          <SidebarSkeleton key={index} />
        ))}
      </div>
    </aside>
  );
}
