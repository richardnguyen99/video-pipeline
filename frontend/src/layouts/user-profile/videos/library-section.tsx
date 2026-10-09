import { LibraryVideoCard } from "@/layouts/user-profile/videos/library-video-card";
import { LikedSection } from "@/layouts/user-profile/videos/liked-section";
import { PlaylistSection } from "@/layouts/user-profile/playlists/section";
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
  sharedPlaylists: Array<PlaylistSummary>;
  watchedVideos: Array<WatchedVideo>;
  isWatchedLoading: boolean;
  likedVideos: Array<Video>;
  isLikedLoading: boolean;
  isPlaylistsLoading: boolean;
  isOwner: boolean;
  username: string;
  authUserId: string | null;
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
  sharedPlaylists: Array<PlaylistSummary>,
  isOwner: boolean,
  authUserId: string | null,
): Array<PlaylistSummary> {
  if (section.kind !== "playlists") {
    return [];
  }

  const title = section.title.toLowerCase();

  if (title.includes("private")) {
    return playlists.filter((item) => item.visibility === "private");
  }

  if (title.includes("curated")) {
    return sharedPlaylists.filter(
      (item) => item.visibility === "restricted" && (authUserId == null || item.owner_id !== authUserId),
    );
  }

  if (title.includes("public")) {
    return playlists.filter((item) => item.visibility === "public");
  }

  return isOwner ? playlists : playlists.filter((item) => item.visibility === "public");
}

export function LibrarySection({
  section,
  videos,
  playlists,
  sharedPlaylists,
  watchedVideos,
  isWatchedLoading,
  likedVideos,
  isLikedLoading,
  isPlaylistsLoading,
  isOwner,
  username,
  authUserId,
}: LibrarySectionProps) {
  const viewAllTo = getSectionViewAllTo(section.kind);
  const sectionUsername = viewAllTo == null ? undefined : username;
  const isCuratedSection = section.title.toLowerCase().includes("curated");
  const sectionPlaylists = filterPlaylistsForSection(section, playlists, sharedPlaylists, isOwner, authUserId).slice(
    0,
    PLAYLIST_PREVIEW_LIMIT,
  );

  let emptyMessage = "Public playlists will show up here.";

  if (section.title.toLowerCase().includes("private")) {
    emptyMessage = "Private playlists you create will show up here.";
  } else if (isCuratedSection) {
    emptyMessage = "Restricted playlists shared with you will show up here.";
  }

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
          isOwner={isOwner && !isCuratedSection}
          isLoading={isPlaylistsLoading}
          emptyMessage={emptyMessage}
        />
      ) : null}
    </section>
  );
}
