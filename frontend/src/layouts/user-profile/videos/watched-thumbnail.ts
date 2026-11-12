import type { Video } from "@/types/video";
import type { WatchedVideo } from "@/queries/video-watch";

export function watchedThumbnail(video: Video): string {
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

export function watchProgressPercent(video: WatchedVideo): number {
  // Catalog duration is stored in minutes; watch position is seconds.
  const durationSeconds = typeof video.duration === "number" && video.duration > 0 ? video.duration * 60 : 0;
  const position = Math.max(0, video.position_seconds);

  if (durationSeconds <= 0) {
    return 0;
  }

  return Math.min(100, (position / durationSeconds) * 100);
}
