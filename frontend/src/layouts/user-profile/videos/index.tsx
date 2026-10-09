import { LibrarySection } from "@/layouts/user-profile/videos/library-section";
import { librarySections } from "@/layouts/user-profile/videos/section-config";
import type { Video } from "@/mocks/videos";
import type { PlaylistSummary } from "@/queries/playlist";
import type { WatchedVideo } from "@/queries/video-watch";
import type { UserVideoItem } from "@/queries/user-profile";

type PanelProps = {
  videos: Array<UserVideoItem>;
  playlists: Array<PlaylistSummary>;
  sharedPlaylists?: Array<PlaylistSummary>;
  watchedVideos: Array<WatchedVideo>;
  isWatchedLoading?: boolean;
  likedVideos: Array<Video>;
  isLikedLoading?: boolean;
  isPlaylistsLoading?: boolean;
  isOwner: boolean;
  username: string;
  authUserId?: string | null;
};

export function Panel({
  videos,
  playlists,
  sharedPlaylists = [],
  watchedVideos,
  isWatchedLoading = false,
  likedVideos,
  isLikedLoading = false,
  isPlaylistsLoading = false,
  isOwner,
  username,
  authUserId = null,
}: PanelProps) {
  const sections = librarySections(isOwner);

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <LibrarySection
          key={section.title}
          section={section}
          videos={videos}
          playlists={playlists}
          sharedPlaylists={sharedPlaylists}
          watchedVideos={watchedVideos}
          isWatchedLoading={isWatchedLoading}
          likedVideos={likedVideos}
          isLikedLoading={isLikedLoading}
          isPlaylistsLoading={isPlaylistsLoading}
          isOwner={isOwner}
          username={username}
          authUserId={authUserId}
        />
      ))}
    </div>
  );
}
