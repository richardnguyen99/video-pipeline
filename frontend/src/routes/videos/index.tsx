import { createFileRoute } from "@tanstack/react-router";

import { VideoBrowse } from "@/layouts/video-browse";
import type { VideoDiscoverFilters } from "@/libs/discover-videos";
import {
  DEFAULT_VIDEO_SORT,
  getAvailableDiscoverActresses,
  getAvailableDiscoverDirectors,
  getAvailableDiscoverGenres,
  getAvailableDiscoverLabels,
  getAvailableDiscoverMakers,
  getAvailableDiscoverSeries,
  getDiscoverVideos,
  parseFeaturesCnt,
  softParseVideoDiscoverSearch,
} from "@/libs/discover-videos";
import { parseSearch } from "@/libs/search-params";

export const Route = createFileRoute("/videos/")({
  component: VideosDiscoverPage,
  validateSearch: (search: Record<string, unknown>) => {
    const { data } = softParseVideoDiscoverSearch(search);

    return data;
  },
  loaderDeps: ({ search }) => ({
    sort: search.sort,
    page: search.page,
    actress: search.actress,
    genre: search.genre,
    maker: search.maker,
    label: search.label,
    director: search.director,
    series: search.series,
    features_cnt: search.features_cnt,
  }),
  loader: async ({ location }) => {
    const rawSearch = parseSearch(location.searchStr);
    const { data, issues } = softParseVideoDiscoverSearch(rawSearch);

    const filters: VideoDiscoverFilters = {
      actresses: data.actress ?? [],
      genres: data.genre ?? [],
      maker: data.maker,
      label: data.label,
      director: data.director,
      series: data.series,
      features_cnt: parseFeaturesCnt(data.features_cnt),
    };
    const sort = data.sort ?? DEFAULT_VIDEO_SORT;
    const pageNum = data.page ?? 1;

    const page = await getDiscoverVideos({ sort, filters, page: pageNum });

    return {
      videos: page.videos,
      total: page.total,
      page: page.page,
      totalPages: page.totalPages,
      sort: page.sort,
      filters: page.filters,
      searchIssues: issues,
      actressOptions: getAvailableDiscoverActresses(),
      genreOptions: getAvailableDiscoverGenres(),
      makerOptions: getAvailableDiscoverMakers(),
      labelOptions: getAvailableDiscoverLabels(),
      directorOptions: getAvailableDiscoverDirectors(),
      seriesOptions: getAvailableDiscoverSeries(),
    };
  },
});

function VideosDiscoverPage() {
  const data = Route.useLoaderData();

  return (
    <VideoBrowse
      title="Videos"
      description="Discover titles across the catalog."
      videos={data.videos}
      total={data.total}
      page={data.page}
      totalPages={data.totalPages}
      sort={data.sort}
      filters={data.filters}
      searchIssues={data.searchIssues}
      actressOptions={data.actressOptions}
      genreOptions={data.genreOptions}
      makerOptions={data.makerOptions}
      labelOptions={data.labelOptions}
      directorOptions={data.directorOptions}
      seriesOptions={data.seriesOptions}
    />
  );
}
