import { ActressBanner } from "@/layouts/single-actress/actress-banner";
import { ActressVideos } from "@/layouts/single-actress/actress-videos";
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
      <ActressVideos videos={videos} />
    </div>
  );
}
