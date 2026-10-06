import { LibrarySection } from "@/layouts/user-profile/videos/library-section";
import { librarySections } from "@/layouts/user-profile/videos/section-config";
import type { Video } from "@/mocks/videos";
import type { WatchedVideo } from "@/queries/video-watch";
import type { UserPlaylistItem, UserVideoItem } from "@/queries/user-profile";

type PanelProps = {
  videos: Array<UserVideoItem>;
  playlists: Array<UserPlaylistItem>;
  watchedVideos: Array<WatchedVideo>;
  isWatchedLoading?: boolean;
  likedVideos: Array<Video>;
  isLikedLoading?: boolean;
  isOwner: boolean;
  username: string;
};

export function Panel({
  videos,
  playlists,
  watchedVideos,
  isWatchedLoading = false,
  likedVideos,
  isLikedLoading = false,
  isOwner,
  username,
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
          watchedVideos={watchedVideos}
          isWatchedLoading={isWatchedLoading}
          likedVideos={likedVideos}
          isLikedLoading={isLikedLoading}
          isOwner={isOwner}
          username={username}
        />
      ))}
    </div>
  );
}
