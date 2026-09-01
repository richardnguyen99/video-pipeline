import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { VideoBrowse } from "@/layouts/video-browse";
import type { VideoDiscoverFilters } from "@/libs/discover-videos";
import {
  DEFAULT_VIDEO_SORT,
  getAvailableDiscoverDirectors,
  getAvailableDiscoverLabels,
  getAvailableDiscoverMakers,
  parseFeaturesCnt,
  softParseVideoDiscoverSearch,
} from "@/libs/discover-videos";
import { parseSearch } from "@/libs/search-params";
import { actressFilterInfiniteOptions } from "@/queries/actresses";
import { genreFilterInfiniteOptions } from "@/queries/genres";
import { seriesFilterInfiniteOptions } from "@/queries/series";
import { videoListQueryOptions } from "@/queries/videos";
import type { VideoListQueryParams } from "@/queries/videos";

function buildVideoListParams(locationSearchStr: string): {
  queryParams: VideoListQueryParams;
  searchIssues: ReturnType<typeof softParseVideoDiscoverSearch>["issues"];
} {
  const rawSearch = parseSearch(locationSearchStr);
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

  const q =
    typeof rawSearch.q === "string"
      ? rawSearch.q
      : Array.isArray(rawSearch.q)
        ? String(rawSearch.q[0] ?? "")
        : undefined;

  const locale = typeof rawSearch.locale === "string" ? rawSearch.locale : undefined;

  return {
    queryParams: {
      sort: data.sort ?? DEFAULT_VIDEO_SORT,
      page: data.page ?? 1,
      actress: filters.actresses,
      genre: filters.genres,
      maker: filters.maker,
      label: filters.label,
      director: filters.director,
      series: filters.series,
      features_cnt: filters.features_cnt,
      q: q || undefined,
      locale,
    },
    searchIssues: issues,
  };
}

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
  loader: async ({ context, location }) => {
    const { queryParams, searchIssues } = buildVideoListParams(location.searchStr);

    await Promise.all([
      context.queryClient.ensureQueryData(videoListQueryOptions(queryParams)),
      context.queryClient.ensureInfiniteQueryData(actressFilterInfiniteOptions()),
      context.queryClient.ensureInfiniteQueryData(genreFilterInfiniteOptions()),
      context.queryClient.ensureInfiniteQueryData(seriesFilterInfiniteOptions()),
    ]);

    return {
      queryParams,
      searchIssues,
      makerOptions: getAvailableDiscoverMakers(),
      labelOptions: getAvailableDiscoverLabels(),
      directorOptions: getAvailableDiscoverDirectors(),
    };
  },
});

function VideosDiscoverPage() {
  const { queryParams, searchIssues, makerOptions, labelOptions, directorOptions } = Route.useLoaderData();

  const { data } = useSuspenseQuery(videoListQueryOptions(queryParams));

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
      searchIssues={searchIssues}
      makerOptions={makerOptions}
      labelOptions={labelOptions}
      directorOptions={directorOptions}
    />
  );
}
