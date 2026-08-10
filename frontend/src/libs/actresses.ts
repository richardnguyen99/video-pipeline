import { mockActressCatalog } from "@/mocks/actresses";
import type { ActressRef, NamedEntity, Video } from "@/mocks/videos";
import { mockVideos } from "@/mocks/videos";

export const ACTRESSES_PAGE_SIZE = 20;

export type ActressSort =
  | "trending-year"
  | "trending-month"
  | "trending-week"
  | "most-viewed"
  | "most-videos"
  | "most-subscribed"
  | "most-likes";

export interface ActressFilters {
  /** Label entity ids (backend `label.id`) */
  labels: number[];
  /** Genre entity ids (backend `genre.id`) */
  genres: number[];
  /** Maker entity ids (backend `maker.id`) */
  makers: number[];
  cups: string[];
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
  cups: [],
};

export const DEFAULT_ACTRESS_SORT: ActressSort = "trending-month";

/** Aligns with backend `Actress` profile fields used in UI. */
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
  labels: NamedEntity[];
  genres: NamedEntity[];
  makers: NamedEntity[];
}

function engagementFromVideos(videos: Video[]): Map<
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
      cur.totalComments += video.comments ?? 0;
      if (video.label) cur.labels.set(video.label.id, video.label.name);
      if (video.maker) cur.makers.set(video.maker.id, video.maker.name);
      for (const g of video.genres ?? []) cur.genres.set(g.id, g.name);
      map.set(actress.id, cur);
    }
  }
  return map;
}

const LABEL_POOL: NamedEntity[] = [
  { id: 1, name: "Velvet Soft" },
  { id: 2, name: "Night Pulse" },
  { id: 3, name: "Cherry Line" },
  { id: 4, name: "Summer Wave" },
  { id: 5, name: "Urban Glow" },
];

const GENRE_POOL: NamedEntity[] = [
  { id: 1, name: "Drama" },
  { id: 2, name: "Romance" },
  { id: 3, name: "Thriller" },
  { id: 4, name: "Adventure" },
  { id: 5, name: "Comedy" },
  { id: 6, name: "Office" },
  { id: 7, name: "Horror" },
  { id: 8, name: "Family" },
  { id: 9, name: "Slice of Life" },
  { id: 10, name: "Ensemble" },
  { id: 11, name: "Seasonal" },
  { id: 12, name: "Action" },
];

const MAKER_POOL: NamedEntity[] = [
  { id: 1, name: "STUDIO-A" },
  { id: 2, name: "DREAM-STUDIO" },
  { id: 3, name: "HORIZON-FILMS" },
  { id: 4, name: "PREMIUM-LINE" },
  { id: 5, name: "SHADOW-HOUSE" },
  { id: 6, name: "SUNSHINE-PROD" },
  { id: 7, name: "NIGHT-RIDER" },
  { id: 8, name: "NEON-WORKS" },
  { id: 9, name: "SNOW-FILM" },
];

export const CUP_SIZES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"] as const;

export function getAvailableActressLabels(): NamedEntity[] {
  return [...LABEL_POOL].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableActressGenres(): NamedEntity[] {
  return [...GENRE_POOL].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableActressMakers(): NamedEntity[] {
  return [...MAKER_POOL].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableCupSizes(): string[] {
  return [...CUP_SIZES];
}

export function getActressSummaries(videos: Video[] = mockVideos): ActressSummary[] {
  const engagement = engagementFromVideos(videos);

  return mockActressCatalog.map((profile, index) => {
    const stats = engagement.get(profile.id);
    const seed = profile.id * 17 + index;
    const labelCount = 1 + (seed % 2);
    const genreCount = 1 + (seed % 3);
    const seededLabels = Array.from({ length: labelCount }, (_, i) => {
      return LABEL_POOL[(seed + i * 3) % LABEL_POOL.length];
    });
    const seededGenres = Array.from({ length: genreCount }, (_, i) => {
      return GENRE_POOL[(seed + i * 5) % GENRE_POOL.length];
    });
    const seededMakers = [MAKER_POOL[(seed + 2) % MAKER_POOL.length]];
    const totalViews = stats?.totalViews ?? 5_000 + seed * 130;

    return {
      id: profile.id,
      name: profile.name,
      image_url: profile.image_url,
      ruby: profile.ruby ?? null,
      birthday: profile.birthday ?? null,
      bust: profile.bust ?? null,
      cup: profile.cup ?? null,
      waist: profile.waist ?? null,
      hip: profile.hip ?? null,
      height: profile.height ?? null,
      videoCount: getVideosByActressId(profile.id, videos).length,
      totalViews,
      totalLikes: stats?.totalLikes ?? 200 + seed * 3,
      totalComments: stats?.totalComments ?? 20 + (seed % 90),
      subscribers: 1_000 + seed * 11,
      viewsYear: Math.floor(totalViews * (0.55 + (seed % 30) / 100)),
      viewsMonth: Math.floor(totalViews * (0.12 + (seed % 20) / 100)),
      viewsWeek: Math.floor(totalViews * (0.03 + (seed % 10) / 100)),
      labels:
        stats && stats.labels.size > 0
          ? [...stats.labels.entries()].map(([id, name]) => ({ id, name }))
          : [...new Map(seededLabels.map((e) => [e.id, e])).values()],
      genres:
        stats && stats.genres.size > 0
          ? [...stats.genres.entries()].map(([id, name]) => ({ id, name }))
          : [...new Map(seededGenres.map((e) => [e.id, e])).values()],
      makers:
        stats && stats.makers.size > 0 ? [...stats.makers.entries()].map(([id, name]) => ({ id, name })) : seededMakers,
    };
  });
}

export function getActressById(id: number, videos: Video[] = mockVideos): ActressSummary | undefined {
  return getActressSummaries(videos).find((a) => a.id === id);
}

export function getVideosByActressId(id: number, videos: Video[] = mockVideos): Video[] {
  const matched = videos.filter((v) => (v.actresses ?? []).some((a) => a.id === id));

  const actress = mockActressCatalog.find((a) => a.id === id);
  if (!actress || videos.length === 0) {
    return matched;
  }

  // Enough items for multi-page grids (4x4 = 16 per page)
  const targetCount = matched.length > 0 ? Math.max(matched.length, 24 + (id % 17)) : 24 + (id % 17);

  const pool = matched.length > 0 ? matched : videos;
  const start = (id * 5) % pool.length;
  const result: Video[] = [];

  for (let i = 0; result.length < targetCount; i += 1) {
    const base = pool[(start + i) % pool.length];
    const cloneIndex = Math.floor(i / pool.length);
    const videoId =
      cloneIndex === 0 && matched.some((v) => v.video_id === base.video_id)
        ? base.video_id
        : `${base.video_id}__${result.length}`;

    result.push({
      ...base,
      id: base.id * 1000 + result.length,
      video_id: videoId,
      title: cloneIndex === 0 ? base.title : `${base.title} (${cloneIndex + 1})`,
      views: (base.views ?? 0) + result.length * 137,
      likes: (base.likes ?? 0) + result.length * 11,
      comments: (base.comments ?? 0) + (result.length % 9),
      actresses: [
        {
          id: actress.id,
          name: actress.name,
          image_url: actress.image_url,
        },
        ...(base.actresses ?? []).filter((a) => a.id !== actress.id).slice(0, 2),
      ],
    });
  }

  return result;
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
  const parts: string[] = [];
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

export function filterActresses(actresses: ActressSummary[], filters: ActressFilters): ActressSummary[] {
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

export function sortActresses(actresses: ActressSummary[], sort: ActressSort): ActressSummary[] {
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
  items: ActressSummary[];
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
    videos?: Video[];
  } = {},
): Promise<ActressPageResult> {
  const pageSize = options.pageSize ?? ACTRESSES_PAGE_SIZE;
  const sort = options.sort ?? DEFAULT_ACTRESS_SORT;
  const filters = options.filters ?? DEFAULT_ACTRESS_FILTERS;
  const videos = options.videos ?? mockVideos;

  const filtered = filterActresses(getActressSummaries(videos), filters);
  const sorted = sortActresses(filtered, sort);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
    sort,
    filters,
  };
}

export const ACTRESS_SORT_OPTIONS: {
  value: ActressSort;
  label: string;
  group?: string;
}[] = [
  { value: "trending-year", label: "This year", group: "Trending" },
  { value: "trending-month", label: "This month", group: "Trending" },
  { value: "trending-week", label: "This week", group: "Trending" },
  { value: "most-viewed", label: "Most viewed" },
  { value: "most-videos", label: "Most videos" },
  { value: "most-subscribed", label: "Most subscribed" },
  { value: "most-likes", label: "Most likes" },
];

export type ActressesSearchParams = {
  page?: number;
  sort?: ActressSort;
  labels?: number[];
  genres?: number[];
  makers?: number[];
  cups?: string[];
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

/** Build search params, omitting defaults so the URL stays clean. */
export function buildActressesSearch(input: {
  page?: number;
  sort?: ActressSort;
  filters?: ActressFilters;
}): ActressesSearchParams {
  const filters = input.filters ?? DEFAULT_ACTRESS_FILTERS;
  const search: ActressesSearchParams = {};

  const page = input.page ?? 1;
  if (page > 1) search.page = page;

  const sort = input.sort ?? DEFAULT_ACTRESS_SORT;
  if (sort !== DEFAULT_ACTRESS_SORT) search.sort = sort;

  if (filters.labels.length > 0) search.labels = filters.labels;
  if (filters.genres.length > 0) search.genres = filters.genres;
  if (filters.makers.length > 0) search.makers = filters.makers;
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
