import type { ActressRef, NamedEntity, Video } from "@/types/video";

export const ACTRESSES_PAGE_SIZE = 24;

export type ActressSort =
  | "trending-year"
  | "trending-month"
  | "trending-week"
  | "most-viewed"
  | "most-videos"
  | "most-subscribed"
  | "most-likes";

export interface ActressFilters {
  labels: Array<number>;
  genres: Array<number>;
  makers: Array<number>;
  series: Array<number>;
  directors: Array<number>;
  cups: Array<string>;
  bustMin?: number;
  bustMax?: number;
  waistMin?: number;
  waistMax?: number;
  hipMin?: number;
  hipMax?: number;
  heightMin?: number;
  heightMax?: number;
  ageMin?: number;
  ageMax?: number;
}

export const DEFAULT_ACTRESS_FILTERS: ActressFilters = {
  labels: [],
  genres: [],
  makers: [],
  series: [],
  directors: [],
  cups: [],
};

export const DEFAULT_ACTRESS_SORT: ActressSort = "trending-month";

export interface ActressBannerRef {
  id: number;
  url: string;
}

export interface ActressSummary extends ActressRef {
  ruby?: string | null;
  birthday?: string | null;
  bust?: number | null;
  cup?: string | null;
  waist?: number | null;
  hip?: number | null;
  height?: number | null;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  subscribers: number;
  viewsYear: number;
  viewsMonth: number;
  viewsWeek: number;
  labels: Array<NamedEntity>;
  genres: Array<NamedEntity>;
  makers: Array<NamedEntity>;
  banner?: ActressBannerRef | null;
}

function engagementFromVideos(videos: Array<Video>): Map<
  number,
  {
    videoCount: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    labels: Map<number, string>;
    genres: Map<number, string>;
    makers: Map<number, string>;
  }
> {
  const map = new Map<
    number,
    {
      videoCount: number;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      labels: Map<number, string>;
      genres: Map<number, string>;
      makers: Map<number, string>;
    }
  >();

  for (const video of videos) {
    for (const actress of video.actresses ?? []) {
      const cur = map.get(actress.id) ?? {
        videoCount: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        labels: new Map<number, string>(),
        genres: new Map<number, string>(),
        makers: new Map<number, string>(),
      };

      cur.videoCount += 1;
      cur.totalViews += video.views ?? 0;
      cur.totalLikes += video.likes ?? 0;
      cur.totalComments += video.comments?.length ?? 0;

      if (video.label) cur.labels.set(video.label.id, video.label.name);
      if (video.maker) cur.makers.set(video.maker.id, video.maker.name);

      for (const g of video.genres ?? []) cur.genres.set(g.id, g.name);

      map.set(actress.id, cur);
    }
  }
  return map;
}

const LABEL_POOL: Array<NamedEntity> = [];

const GENRE_POOL: Array<NamedEntity> = [];

const MAKER_POOL: Array<NamedEntity> = [];

export const CUP_SIZES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"] as const;

export function getAvailableActressLabels(): Array<NamedEntity> {
  return [...LABEL_POOL].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableActressGenres(): Array<NamedEntity> {
  return [...GENRE_POOL].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableActressMakers(): Array<NamedEntity> {
  return [...MAKER_POOL].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableCupSizes(): Array<string> {
  return [...CUP_SIZES];
}

export function getActressSummaries(videos: Array<Video> = []): Array<ActressSummary> {
  const engagement = engagementFromVideos(videos);
  const summaries: Array<ActressSummary> = [];

  for (const [actressId, stats] of engagement.entries()) {
    let profile: ActressRef | null = null;

    for (const video of videos) {
      const match = (video.actresses ?? []).find((actress) => actress.id === actressId);

      if (match != null) {
        profile = match;
        break;
      }
    }

    if (profile == null) {
      continue;
    }

    summaries.push({
      id: profile.id,
      name: profile.name,
      image_url: profile.image_url,
      ruby: profile.ruby ?? null,
      birthday: null,
      bust: null,
      cup: null,
      waist: null,
      hip: null,
      height: null,
      videoCount: stats.videoCount,
      totalViews: stats.totalViews,
      totalLikes: stats.totalLikes,
      totalComments: stats.totalComments,
      subscribers: 0,
      viewsYear: stats.totalViews,
      viewsMonth: stats.totalViews,
      viewsWeek: stats.totalViews,
      labels: [...stats.labels.entries()].map(([id, name]) => ({ id, name })),
      genres: [...stats.genres.entries()].map(([id, name]) => ({ id, name })),
      makers: [...stats.makers.entries()].map(([id, name]) => ({ id, name })),
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export function getActressById(id: number, videos: Array<Video> = []): ActressSummary | undefined {
  return getActressSummaries(videos).find((a) => a.id === id);
}

export function getVideosByActressId(id: number, videos: Array<Video> = []): Array<Video> {
  return videos.filter((v) => (v.actresses ?? []).some((a) => a.id === id));
}

export function formatAge(birthday?: string | null): number | null {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function formatBirthdayLabel(birthday?: string | null): string | null {
  if (!birthday) return null;
  const age = formatAge(birthday);
  if (age == null) return birthday;
  return `${birthday} (${age})`;
}

export function formatMeasurements(actress: ActressSummary): string | null {
  const parts: Array<string> = [];
  if (actress.bust != null) {
    parts.push(actress.cup ? `B${actress.bust}${actress.cup}` : `B${actress.bust}`);
  } else if (actress.cup) {
    parts.push(`Cup ${actress.cup}`);
  }
  if (actress.waist != null) parts.push(`W${actress.waist}`);
  if (actress.hip != null) parts.push(`H${actress.hip}`);
  if (actress.height != null) parts.push(`${actress.height}cm`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function inRange(value: number | null | undefined, min?: number, max?: number): boolean {
  if (value == null) return min == null && max == null;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function filterActresses(actresses: Array<ActressSummary>, filters: ActressFilters): Array<ActressSummary> {
  return actresses.filter((a) => {
    if (filters.labels.length > 0) {
      if (!filters.labels.some((id) => a.labels.some((l) => l.id === id))) return false;
    }
    if (filters.genres.length > 0) {
      if (!filters.genres.some((id) => a.genres.some((g) => g.id === id))) return false;
    }
    if (filters.makers.length > 0) {
      if (!filters.makers.some((id) => a.makers.some((m) => m.id === id))) return false;
    }
    if (filters.cups.length > 0) {
      if (!a.cup || !filters.cups.includes(a.cup)) return false;
    }
    if (!inRange(a.bust, filters.bustMin, filters.bustMax)) return false;
    if (!inRange(a.waist, filters.waistMin, filters.waistMax)) return false;
    if (!inRange(a.hip, filters.hipMin, filters.hipMax)) return false;
    if (!inRange(a.height, filters.heightMin, filters.heightMax)) return false;
    const age = formatAge(a.birthday);
    if (filters.ageMin != null || filters.ageMax != null) {
      if (age == null) return false;
      if (filters.ageMin != null && age < filters.ageMin) return false;
      if (filters.ageMax != null && age >= filters.ageMax) return false;
    }
    return true;
  });
}

export function sortActresses(actresses: Array<ActressSummary>, sort: ActressSort): Array<ActressSummary> {
  const list = [...actresses];
  const byNumber = (getter: (a: ActressSummary) => number) =>
    list.sort((a, b) => getter(b) - getter(a) || a.name.localeCompare(b.name));

  switch (sort) {
    case "trending-year":
      return byNumber((a) => a.viewsYear);
    case "trending-month":
      return byNumber((a) => a.viewsMonth);
    case "trending-week":
      return byNumber((a) => a.viewsWeek);
    case "most-viewed":
      return byNumber((a) => a.totalViews);
    case "most-videos":
      return byNumber((a) => a.videoCount);
    case "most-subscribed":
      return byNumber((a) => a.subscribers);
    case "most-likes":
      return byNumber((a) => a.totalLikes);
    default:
      return byNumber((a) => a.totalViews);
  }
}

export type ActressPageResult = {
  items: Array<ActressSummary>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: ActressSort;
  filters: ActressFilters;
};

export async function getActressPage(
  page: number,
  options: {
    pageSize?: number;
    sort?: ActressSort;
    filters?: ActressFilters;
    videos?: Array<Video>;
  } = {},
): Promise<ActressPageResult> {
  const { fetchActressPage } = await import("@/queries/actresses");

  return fetchActressPage({
    page,
    pageSize: options.pageSize,
    sort: options.sort,
    filters: options.filters,
  });
}

export const ACTRESS_SORT_OPTIONS: Array<{
  value: ActressSort;
  label: string;
  group?: string;
}> = [
  { value: "trending-year", label: "This year", group: "Trending" },
  { value: "trending-month", label: "This month", group: "Trending" },
  { value: "trending-week", label: "This week", group: "Trending" },
  { value: "most-viewed", label: "Most viewed" },
  { value: "most-videos", label: "Most videos" },
  { value: "most-subscribed", label: "Most subscribed" },
  { value: "most-likes", label: "Most likes" },
];

export type ActressesSearchParams = {
  series?: Array<number>;
  page?: number;
  sort?: ActressSort;
  q?: string;
  labels?: Array<number>;
  genres?: Array<number>;
  makers?: Array<number>;
  directors?: Array<number>;
  cups?: Array<string>;
  bustMin?: number;
  bustMax?: number;
  waistMin?: number;
  waistMax?: number;
  hipMin?: number;
  hipMax?: number;
  heightMin?: number;
  heightMax?: number;
  ageMin?: number;
  ageMax?: number;
};

export function buildActressesSearch(input: {
  page?: number;
  sort?: ActressSort;
  filters?: ActressFilters;
  q?: string | null;
}): ActressesSearchParams {
  const filters = input.filters ?? DEFAULT_ACTRESS_FILTERS;
  const search: ActressesSearchParams = {};

  const page = input.page ?? 1;

  if (page > 1) {
    search.page = page;
  }

  const sort = input.sort ?? DEFAULT_ACTRESS_SORT;

  if (sort !== DEFAULT_ACTRESS_SORT) {
    search.sort = sort;
  }

  const q = input.q?.trim();

  if (q) {
    search.q = q;
  }

  if (filters.labels.length > 0) search.labels = filters.labels;
  if (filters.genres.length > 0) search.genres = filters.genres;
  if (filters.series.length > 0) search.series = filters.series;
  if (filters.makers.length > 0) search.makers = filters.makers;
  if (filters.directors.length > 0) search.directors = filters.directors;
  if (filters.cups.length > 0) search.cups = filters.cups;
  if (filters.bustMin != null) search.bustMin = filters.bustMin;
  if (filters.bustMax != null) search.bustMax = filters.bustMax;
  if (filters.waistMin != null) search.waistMin = filters.waistMin;
  if (filters.waistMax != null) search.waistMax = filters.waistMax;
  if (filters.hipMin != null) search.hipMin = filters.hipMin;
  if (filters.hipMax != null) search.hipMax = filters.hipMax;
  if (filters.heightMin != null) search.heightMin = filters.heightMin;
  if (filters.heightMax != null) search.heightMax = filters.heightMax;
  if (filters.ageMin != null) search.ageMin = filters.ageMin;
  if (filters.ageMax != null) search.ageMax = filters.ageMax;

  return search;
}
