import { Link } from "@tanstack/react-router";
import { ChevronRight, Eye, MessageCircle, Play, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/libs/utils";
import type { WatchedVideo } from "@/queries/video-watch";
import type { UserPlaylistItem, UserVideoItem } from "@/queries/user-profile";

type VideosPanelProps = {
  videos: Array<UserVideoItem>;
  playlists: Array<UserPlaylistItem>;
  watchedVideos: Array<WatchedVideo>;
  isWatchedLoading?: boolean;
  isOwner: boolean;
};

function watchedThumbnail(video: WatchedVideo): string {
  const images = video.video_image_url ?? [];
  const largeImages = images.filter((item) => typeof item.type === "string" && item.type.toLowerCase() === "large");
  const candidates =
    largeImages.length > 0 ? [...largeImages].sort((a, b) => a.id - b.id) : [...images].sort((a, b) => a.id - b.id);
  const preferred = candidates.at(0);

  if (preferred !== undefined && preferred.url !== "") {
    return preferred.url;
  }

  if (video.image_urls?.[0]) {
    return video.image_urls[0];
  }

  return "https://placehold.co/1280x720?text=No+Thumbnail";
}

export function VideosPanel({ videos, playlists, watchedVideos, isWatchedLoading = false, isOwner }: VideosPanelProps) {
  const sections = isOwner
    ? [
        {
          title: "Watched videos",
          subtitle: "Your recent watch history",
          kind: "watched" as const,
        },
        {
          title: "Liked videos",
          subtitle: "Videos you want to revisit",
          kind: "videos" as const,
        },
        {
          title: "Private playlists",
          subtitle: "Only visible to you",
          kind: "playlists" as const,
        },
        {
          title: "Public uploaded videos",
          subtitle: "What you have shared",
          kind: "videos" as const,
        },
        {
          title: "Public playlists",
          subtitle: "Curated by you",
          kind: "playlists" as const,
        },
      ]
    : [
        {
          title: "Public uploaded videos",
          subtitle: "What they have shared",
          kind: "videos" as const,
        },
        {
          title: "Public playlists",
          subtitle: "Curated lists",
          kind: "playlists" as const,
        },
      ];

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">{section.title}</h3>

              <p className="text-sm text-muted-foreground">{section.subtitle}</p>
            </div>

            <Button type="button" variant="ghost" size="sm">
              View all
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>

          {section.kind === "watched" ? (
            isWatchedLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={`watched-skeleton-${index}`}
                    className="overflow-hidden rounded-xl border border-border/60 bg-card/40"
                  >
                    <Skeleton className="aspect-video w-full rounded-none" />

                    <div className="space-y-2 p-3">
                      <Skeleton className="h-4 w-24" />

                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : watchedVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Videos you watch will show up here.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {watchedVideos.map((video, index) => {
                  const views = video.views ?? 0;
                  const likes = video.likes ?? 0;
                  const comments =
                    typeof video.comments === "number"
                      ? video.comments
                      : Array.isArray(video.comments)
                        ? video.comments.length
                        : 0;
                  const poster = watchedThumbnail(video);
                  // Catalog duration is stored in minutes; watch position is seconds.
                  const durationSeconds =
                    typeof video.duration === "number" && video.duration > 0 ? video.duration * 60 : 0;
                  const position = Math.max(0, video.position_seconds);
                  const progressPercent = durationSeconds > 0 ? Math.min(100, (position / durationSeconds) * 100) : 0;

                  return (
                    <Link
                      key={video.id}
                      to="/videos/$id"
                      params={{ id: String(video.id) }}
                      className="overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-primary/40"
                    >
                      <div className="relative aspect-video overflow-hidden bg-muted">
                        <img src={poster} alt={video.video_id} loading="lazy" className="size-full object-cover" />

                        <span className="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                          {index + 1}
                        </span>
                      </div>

                      <Progress value={progressPercent} className="h-1 rounded-none" />

                      <div className="p-3">
                        <h4 className="line-clamp-2 text-sm font-medium">{video.video_id}</h4>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="size-3.5 shrink-0" aria-hidden />
                            {formatCompactNumber(views)}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
                            {formatCompactNumber(likes)}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="size-3.5 shrink-0" aria-hidden />
                            {formatCompactNumber(comments)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          ) : null}

          {section.kind === "videos" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video, index) => (
                <article
                  key={`${section.title}-${video.id}`}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card/40"
                >
                  <div className="relative flex aspect-video items-center justify-center bg-muted">
                    <span className="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                      {index + 1}
                    </span>

                    <Play className="size-8 text-muted-foreground" aria-hidden />
                  </div>

                  <div className="p-3">
                    <h4 className="line-clamp-2 text-sm font-medium">{video.title}</h4>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {isOwner ? `${video.views} views` : "Public video"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {section.kind === "playlists" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((playlist, index) => (
                <article
                  key={`${section.title}-${playlist.id}`}
                  className="flex gap-3 rounded-xl border border-border/60 bg-card/40 p-3"
                >
                  <div className="relative flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <span className="absolute top-1 left-1 text-[10px] font-medium text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <Play className="size-5 text-muted-foreground" aria-hidden />
                  </div>

                  <div className="min-w-0">
                    <h4 className="line-clamp-2 text-sm font-medium">{playlist.title}</h4>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {playlist.video_count} videos
                      {isOwner ? " · Updated recently" : " · Public playlist"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
