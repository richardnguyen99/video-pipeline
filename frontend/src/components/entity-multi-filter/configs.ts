import type { EntityMultiFilterConfig } from "@/components/entity-multi-filter/index";
import {
  DEFAULT_DIRECTOR_LOCALE,
  directorDetailQueryOptions,
  directorFilterInfiniteOptions,
  flattenDirectorFilterPages,
  mapDirectorDetailToNamedEntity,
} from "@/queries/directors";
import type { DirectorDetailApi, DirectorListApiResponse } from "@/queries/directors";
import {
  DEFAULT_GENRE_LOCALE,
  flattenGenreFilterPages,
  genreDetailQueryOptions,
  genreFilterInfiniteOptions,
  mapGenreDetailToNamedEntity,
} from "@/queries/genres";
import type { GenreDetailApi, GenreListApiResponse } from "@/queries/genres";
import {
  DEFAULT_LABEL_LOCALE,
  flattenLabelFilterPages,
  labelDetailQueryOptions,
  labelFilterInfiniteOptions,
  mapLabelDetailToNamedEntity,
} from "@/queries/labels";
import type { LabelDetailApi, LabelListApiResponse } from "@/queries/labels";
import {
  DEFAULT_MAKER_LOCALE,
  flattenMakerFilterPages,
  makerDetailQueryOptions,
  makerFilterInfiniteOptions,
  mapMakerDetailToNamedEntity,
} from "@/queries/makers";
import type { MakerDetailApi, MakerListApiResponse } from "@/queries/makers";
import {
  DEFAULT_SERIES_LOCALE,
  flattenSeriesFilterPages,
  mapSeriesDetailToNamedEntity,
  seriesDetailQueryOptions,
  seriesFilterInfiniteOptions,
} from "@/queries/series";
import type { SeriesDetailApi, SeriesListApiResponse } from "@/queries/series";

export const genreMultiFilterConfig: EntityMultiFilterConfig<GenreDetailApi> = {
  label: "Genre",
  searchPlaceholder: "Search genres…",
  locale: DEFAULT_GENRE_LOCALE,
  infiniteOptions: genreFilterInfiniteOptions,
  flattenPages: (pages) => flattenGenreFilterPages(pages as GenreListApiResponse[] | undefined),
  detailQueryOptions: genreDetailQueryOptions,
  mapDetailToNamedEntity: mapGenreDetailToNamedEntity,
};

export const seriesMultiFilterConfig: EntityMultiFilterConfig<SeriesDetailApi> = {
  label: "Series",
  searchPlaceholder: "Search series…",
  locale: DEFAULT_SERIES_LOCALE,
  infiniteOptions: seriesFilterInfiniteOptions,
  flattenPages: (pages) => flattenSeriesFilterPages(pages as SeriesListApiResponse[] | undefined),
  detailQueryOptions: seriesDetailQueryOptions,
  mapDetailToNamedEntity: mapSeriesDetailToNamedEntity,
};

export const makerMultiFilterConfig: EntityMultiFilterConfig<MakerDetailApi> = {
  label: "Maker",
  searchPlaceholder: "Search makers…",
  locale: DEFAULT_MAKER_LOCALE,
  infiniteOptions: makerFilterInfiniteOptions,
  flattenPages: (pages) => flattenMakerFilterPages(pages as MakerListApiResponse[] | undefined),
  detailQueryOptions: makerDetailQueryOptions,
  mapDetailToNamedEntity: mapMakerDetailToNamedEntity,
};

export const labelMultiFilterConfig: EntityMultiFilterConfig<LabelDetailApi> = {
  label: "Label",
  searchPlaceholder: "Search labels…",
  locale: DEFAULT_LABEL_LOCALE,
  infiniteOptions: labelFilterInfiniteOptions,
  flattenPages: (pages) => flattenLabelFilterPages(pages as LabelListApiResponse[] | undefined),
  detailQueryOptions: labelDetailQueryOptions,
  mapDetailToNamedEntity: mapLabelDetailToNamedEntity,
};

export const directorMultiFilterConfig: EntityMultiFilterConfig<DirectorDetailApi> = {
  label: "Director",
  searchPlaceholder: "Search directors…",
  locale: DEFAULT_DIRECTOR_LOCALE,
  infiniteOptions: directorFilterInfiniteOptions,
  flattenPages: (pages) => flattenDirectorFilterPages(pages as DirectorListApiResponse[] | undefined),
  detailQueryOptions: directorDetailQueryOptions,
  mapDetailToNamedEntity: mapDirectorDetailToNamedEntity,
};
