import { LibraryVideoCard } from "@/layouts/user-profile/videos/library-video-card";
import { LikedSection } from "@/layouts/user-profile/videos/liked-section";
import { PlaylistSection } from "@/layouts/user-profile/videos/playlist-section";
import { SectionHeader } from "@/layouts/user-profile/videos/section-header";
import type { LibrarySection as LibrarySectionConfig } from "@/layouts/user-profile/videos/section-config";
import { WatchedSection } from "@/layouts/user-profile/videos/watched-section";
import type { Video } from "@/mocks/videos";
import type { PlaylistSummary } from "@/queries/playlist";
import type { WatchedVideo } from "@/queries/video-watch";
import type { UserVideoItem } from "@/queries/user-profile";

const PLAYLIST_PREVIEW_LIMIT = 6;

type LibrarySectionProps = {
  section: LibrarySectionConfig;
  videos: Array<UserVideoItem>;
  playlists: Array<PlaylistSummary>;
  watchedVideos: Array<WatchedVideo>;
  isWatchedLoading: boolean;
  likedVideos: Array<Video>;
  isLikedLoading: boolean;
  isPlaylistsLoading: boolean;
  isOwner: boolean;
  username: string;
};

function getSectionViewAllTo(
  kind: LibrarySectionConfig["kind"],
): "/u/$username/videos/history" | "/u/$username/videos/liked" | "/u/$username/playlists" | undefined {
  switch (kind) {
    case "watched":
      return "/u/$username/videos/history";
    case "liked":
      return "/u/$username/videos/liked";
    case "playlists":
      return "/u/$username/playlists";
    default:
      return undefined;
  }
}

function filterPlaylistsForSection(
  section: LibrarySectionConfig,
  playlists: Array<PlaylistSummary>,
  isOwner: boolean,
): Array<PlaylistSummary> {
  if (section.kind !== "playlists") {
    return [];
  }

  if (section.title.toLowerCase().includes("private")) {
    return playlists.filter((item) => item.visibility === "private");
  }

  if (section.title.toLowerCase().includes("public")) {
    return playlists.filter((item) => item.visibility === "public");
  }

  return isOwner ? playlists : playlists.filter((item) => item.visibility === "public");
}

export function LibrarySection({
  section,
  videos,
  playlists,
  watchedVideos,
  isWatchedLoading,
  likedVideos,
  isLikedLoading,
  isPlaylistsLoading,
  isOwner,
  username,
}: LibrarySectionProps) {
  const viewAllTo = getSectionViewAllTo(section.kind);
  const sectionUsername = viewAllTo == null ? undefined : username;
  const sectionPlaylists = filterPlaylistsForSection(section, playlists, isOwner).slice(0, PLAYLIST_PREVIEW_LIMIT);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={section.title}
        subtitle={section.subtitle}
        viewAllTo={viewAllTo}
        username={sectionUsername}
      />

      {section.kind === "watched" ? <WatchedSection videos={watchedVideos} isLoading={isWatchedLoading} /> : null}

      {section.kind === "liked" ? <LikedSection videos={likedVideos} isLoading={isLikedLoading} /> : null}

      {section.kind === "videos" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, index) => (
            <LibraryVideoCard key={`${section.title}-${video.id}`} video={video} index={index} isOwner={isOwner} />
          ))}
        </div>
      ) : null}

      {section.kind === "playlists" ? (
        <PlaylistSection
          playlists={sectionPlaylists}
          username={username}
          isOwner={isOwner}
          isLoading={isPlaylistsLoading}
          emptyMessage={
            section.title.toLowerCase().includes("private")
              ? "Private playlists you create will show up here."
              : "Public playlists will show up here."
          }
        />
      ) : null}
    </section>
  );
}
