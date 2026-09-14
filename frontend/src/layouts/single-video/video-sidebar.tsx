import { VideoSidebarCard } from "@/components/video/video-sidebar-card";
import type { Video } from "@/mocks/videos";

interface VideoSidebarProps {
  videos: Video[];
}

const MAX_CARDS = 12;

export function VideoSidebar({ videos }: VideoSidebarProps) {
  const items = videos.slice(0, MAX_CARDS);

  if (items.length === 0) return null;

  return (
    <aside className="hidden w-full shrink-0 lg:block lg:w-90 xl:w-100" aria-label="Related videos">
      <div className="flex flex-col gap-4">
        {items.map((video, index) => (
          <VideoSidebarCard
            key={video.video_id}
            video={video}
            views={video.views ?? 0}
            likes={video.likes ?? 0}
            comments={typeof video.comments === "number" ? video.comments : (video.comments?.length ?? 0)}
            badge={index === 0 ? "recommended" : index < 3 ? "new" : undefined}
          />
        ))}
      </div>
    </aside>
  );
}
