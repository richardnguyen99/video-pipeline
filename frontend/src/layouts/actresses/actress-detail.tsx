import { ActressBannerBackground, ActressProfileHeader } from "@/layouts/single-actress/actress-banner";
import { ActressVideos } from "@/layouts/single-actress/actress-videos";
import { DEFAULT_ACTRESS_VIDEO_FILTERS, DEFAULT_ACTRESS_VIDEO_SORT } from "@/libs/actress-videos";
import type { ActressSummary } from "@/libs/actresses";
import type { Video } from "@/mocks/videos";

interface ActressDetailProps {
  actress: ActressSummary;
  videos: Video[];
}

export function ActressDetail({ actress, videos }: ActressDetailProps) {
  return (
    <div className="relative isolate min-h-screen">
      <ActressBannerBackground actress={actress} />

      <div className="relative z-10 mt-64">
        <ActressProfileHeader actress={actress} />
        <ActressVideos
          videos={videos}
          total={videos.length}
          page={1}
          totalPages={1}
          sort={DEFAULT_ACTRESS_VIDEO_SORT}
          filters={DEFAULT_ACTRESS_VIDEO_FILTERS}
        />
      </div>
    </div>
  );
}
