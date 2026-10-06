import { LibraryVideoCard } from "@/layouts/user-profile/videos/library-video-card";
import { PlaylistCard } from "@/layouts/user-profile/videos/playlist-card";
import { SectionHeader } from "@/layouts/user-profile/videos/section-header";
import type { LibrarySection as LibrarySectionConfig } from "@/layouts/user-profile/videos/section-config";
import { WatchedSection } from "@/layouts/user-profile/videos/watched-section";
import type { WatchedVideo } from "@/queries/video-watch";
import type { UserPlaylistItem, UserVideoItem } from "@/queries/user-profile";

type LibrarySectionProps = {
  section: LibrarySectionConfig;
  videos: Array<UserVideoItem>;
  playlists: Array<UserPlaylistItem>;
  watchedVideos: Array<WatchedVideo>;
  isWatchedLoading: boolean;
  isOwner: boolean;
  username: string;
};

export function LibrarySection({
  section,
  videos,
  playlists,
  watchedVideos,
  isWatchedLoading,
  isOwner,
  username,
}: LibrarySectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={section.title}
        subtitle={section.subtitle}
        viewAllTo={section.kind === "watched" ? "/u/$username/videos/history" : undefined}
        username={section.kind === "watched" ? username : undefined}
      />

      {section.kind === "watched" ? <WatchedSection videos={watchedVideos} isLoading={isWatchedLoading} /> : null}

      {section.kind === "videos" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, index) => (
            <LibraryVideoCard key={`${section.title}-${video.id}`} video={video} index={index} isOwner={isOwner} />
          ))}
        </div>
      ) : null}

      {section.kind === "playlists" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist, index) => (
            <PlaylistCard key={`${section.title}-${playlist.id}`} playlist={playlist} index={index} isOwner={isOwner} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
