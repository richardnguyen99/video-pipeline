import { ChevronRight, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UserPlaylistItem, UserVideoItem } from "@/queries/user-profile";

type VideosPanelProps = {
  videos: Array<UserVideoItem>;
  playlists: Array<UserPlaylistItem>;
  isOwner: boolean;
};

export function VideosPanel({ videos, playlists, isOwner }: VideosPanelProps) {
  const sections = isOwner
    ? [
        {
          title: "Watched videos",
          subtitle: "Your recent watch history",
          kind: "videos" as const,
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.kind === "videos"
              ? videos.map((video, index) => (
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
                ))
              : playlists.map((playlist, index) => (
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
        </section>
      ))}
    </div>
  );
}
