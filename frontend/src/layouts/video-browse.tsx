import { CategoryVideoCard } from "@/components/video/category-video-card";
import type { Video } from "@/mocks/videos";

interface VideoBrowseProps {
  title: string;
  description?: string;
  videos: Video[];
}

export function VideoBrowse({ title, description, videos }: VideoBrowseProps) {
  return (
    <div className="min-h-screen pt-16">
      <div className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-16">
        <header className="mb-8">
          <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">{description}</p>
          ) : null}
        </header>

        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No videos in this category yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <li key={video.video_id} className="min-w-0">
                <CategoryVideoCard video={video} variant="grid" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
