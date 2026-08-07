import { ActressBanner } from "@/layouts/single-actress/actress-banner";
import { VideoBrowse } from "@/layouts/video-browse";
import type { ActressSummary } from "@/libs/actresses";
import type { Video } from "@/mocks/videos";

interface ActressDetailProps {
  actress: ActressSummary;
  videos: Video[];
}

export function ActressDetail({ actress, videos }: ActressDetailProps) {
  return (
    <div className="min-h-screen">
      <ActressBanner actress={actress} />
      <VideoBrowse
        title="Featured videos"
        description={`${videos.length} ${videos.length === 1 ? "video" : "videos"}`}
        videos={videos}
        className="pt-0"
      />
    </div>
  );
}
