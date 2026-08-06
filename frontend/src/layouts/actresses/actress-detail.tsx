import { VideoBrowse } from "@/layouts/video-browse";
import type { ActressSummary } from "@/libs/actresses";
import type { Video } from "@/mocks/videos";

interface ActressDetailProps {
  actress: ActressSummary;
  videos: Video[];
}

export function ActressDetail({ actress, videos }: ActressDetailProps) {
  return (
    <VideoBrowse
      title={actress.name}
      description={`${videos.length} featured ${videos.length === 1 ? "video" : "videos"}`}
      videos={videos}
    />
  );
}
