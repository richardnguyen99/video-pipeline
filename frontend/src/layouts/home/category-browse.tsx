import { Link } from "@tanstack/react-router";

import type { Video } from "@/mocks/videos";

function getThumbnail(video: Video): string {
  return video.image_urls?.[0] ?? video.video_image_url?.[0]?.url ?? "https://placehold.co/640/360";
}

function getCode(video: Video): string {
  return video.cid ?? video.video_id;
}

interface CategoryBrowseProps {
  title: string;
  description?: string;
  videos: Video[];
}

export function CategoryBrowse({ title, description, videos }: CategoryBrowseProps) {
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
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <li key={video.video_id}>
                <Link
                  to="/videos/$video_id"
                  params={{ video_id: video.video_id }}
                  className="group block overflow-hidden rounded-2xl border border-border bg-card/40 transition-all hover:border-primary/50 hover:shadow-[0_0_35px_-12px_var(--color-primary)]"
                >
                  <div className="relative aspect-video w-full">
                    <img
                      src={getThumbnail(video)}
                      alt={video.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h2 className="line-clamp-2 text-sm font-semibold tracking-tight sm:text-base">{video.title}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">{getCode(video)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
