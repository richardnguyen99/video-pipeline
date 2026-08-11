import { z } from "zod";

import type { NamedEntity, Video } from "@/mocks/videos";
import { mockVideos } from "@/mocks/videos";

export const VIDEO_SORT_VALUES = [
  "trending-week",
  "trending-month",
  "trending-all",
  "latest",
  "views",
  "likes",
] as const;

export const videoSortSchema = z.enum(VIDEO_SORT_VALUES);
export type VideoSort = z.infer<typeof videoSortSchema>;

/** Actress feature-count range. `max` omitted means open-ended (N or more). */
export const featuresCountRangeSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative().optional(),
});
export type FeaturesCountRange = z.infer<typeof featuresCountRangeSchema>;

export const videoDiscoverFiltersSchema = z.object({
  actresses: z.array(z.number().int()).default([]),
  genres: z.array(z.number().int()).default([]),
  maker: z.number().int().optional(),
  label: z.number().int().optional(),
  director: z.number().int().optional(),
  series: z.number().int().optional(),
  features_cnt: featuresCountRangeSchema.optional(),
});
export type VideoDiscoverFilters = z.infer<typeof videoDiscoverFiltersSchema>;

export const DEFAULT_VIDEO_SORT: VideoSort = "trending-week";

export const DEFAULT_VIDEO_FILTERS: VideoDiscoverFilters = {
  actresses: [],
  genres: [],
};

export const VIDEO_SORT_OPTIONS: {
  value: VideoSort;
  label: string;
  group?: string;
}[] = [
  { value: "trending-week", label: "This week", group: "Trending" },
  { value: "trending-month", label: "This month", group: "Trending" },
  { value: "trending-all", label: "All time", group: "Trending" },
  { value: "latest", label: "Latest" },
  { value: "views", label: "Most viewed" },
  { value: "likes", label: "Most liked" },
];

const UNSIGNED_INT_RE = /^\d+$/;

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function expectedGotMessage(expected: string, value: unknown): string {
  return `Expected ${expected}. Got ${describeValue(value)} (${describeType(value)})`;
}

/** One unsigned integer from query (number or digit string). Rejects arrays and non-integers. */
export const unsignedIntIdSchema = z.union([
  z
    .number({ error: "Expected an unsigned integer" })
    .int({ error: "Expected an unsigned integer" })
    .nonnegative({ error: "Expected an unsigned integer >= 0" }),
  z
    .string({ error: "Expected an unsigned integer" })
    .regex(UNSIGNED_INT_RE, { error: "Expected an unsigned integer" })
    .transform((s) => Number(s)),
]);

/**
 * Multi-value unsigned int list (FastAPI repeated keys).
 * Accepts a single value or an array; every entry must be an unsigned integer.
 */
export const unsignedIntIdListSchema = z.union([
  unsignedIntIdSchema.transform((id) => [id]),
  z
    .array(unsignedIntIdSchema, {
      error: "Expected one or more unsigned integers",
    })
    .min(1, { error: "Expected one or more unsigned integers" }),
]);

const optionalUnsignedIntIdSchema = z.optional(unsignedIntIdSchema);
const optionalUnsignedIntIdListSchema = z.optional(unsignedIntIdListSchema);

const featuresCntQuerySchema = z
  .string({ error: "features_cnt must be a string like 2, 3,, or 1,3" })
  .trim()
  .min(1)
  .refine((raw) => parseFeaturesCnt(raw) != null, {
    error: "Invalid features_cnt; use 2 (exact), 3, (min open), or 1,3 (range)",
  });

const optionalFeaturesCntQuerySchema = z.optional(
  z.union([
    featuresCntQuerySchema,
    z
      .number()
      .int()
      .nonnegative()
      .transform((n) => String(n))
      .pipe(featuresCntQuerySchema),
  ]),
);

/**
 * URL search schema (FastAPI-compatible keys).
 * - `actress` / `genre`: repeated unsigned ints → number[]
 * - `maker` / `label` / `director` / `series`: single unsigned int
 * - `features_cnt`: "2" | "3," | "1,3"
 *
 * Strict: invalid values fail the whole schema (use softParse for page UX).
 */
export const videoDiscoverSearchSchema = z
  .object({
    sort: videoSortSchema.optional(),
    actress: optionalUnsignedIntIdListSchema,
    genre: optionalUnsignedIntIdListSchema,
    maker: optionalUnsignedIntIdSchema,
    label: optionalUnsignedIntIdSchema,
    director: optionalUnsignedIntIdSchema,
    series: optionalUnsignedIntIdSchema,
    features_cnt: optionalFeaturesCntQuerySchema,
  })
  .transform((data) => {
    const result: {
      sort?: VideoSort;
      actress?: number[];
      genre?: number[];
      maker?: number;
      label?: number;
      director?: number;
      series?: number;
      features_cnt?: string;
    } = {};

    if (data.sort && data.sort !== DEFAULT_VIDEO_SORT) {
      result.sort = data.sort;
    }

    if (data.actress && data.actress.length > 0) {
      result.actress = data.actress;
    }

    if (data.genre && data.genre.length > 0) {
      result.genre = data.genre;
    }

    if (data.maker != null) {
      result.maker = data.maker;
    }

    if (data.label != null) {
      result.label = data.label;
    }

    if (data.director != null) {
      result.director = data.director;
    }

    if (data.series != null) {
      result.series = data.series;
    }

    if (data.features_cnt) {
      result.features_cnt = data.features_cnt;
    }

    return result;
  });

/** URL query type for `/videos` (validated / normalized). */
export type VideoDiscoverSearchParams = {
  sort?: VideoSort;
  actress?: number[];
  genre?: number[];
  maker?: number;
  label?: number;
  director?: number;
  series?: number;
  features_cnt?: string;
  /** Internal: validation issues; never written to the URL. */
  _searchIssues?: VideoDiscoverSearchIssue[];
};

export type VideoDiscoverSearchIssue = {
  path: string;
  message: string;
};

export type VideoDiscoverSearchParseResult =
  | { success: true; data: VideoDiscoverSearchParams }
  | {
      success: false;
      error: z.ZodError;
      issues: VideoDiscoverSearchIssue[];
    };

export function formatVideoDiscoverSearchIssues(error: z.ZodError): VideoDiscoverSearchIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

function issuesFromResult(
  path: string,
  result: { success: false; error: z.ZodError },
  value?: unknown,
  expected?: string,
): VideoDiscoverSearchIssue[] {
  if (expected !== undefined) {
    return [
      {
        path,
        message: expectedGotMessage(expected, value),
      },
    ];
  }

  return result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? `${path}.${issue.path.join(".")}` : path,
    message: issue.message,
  }));
}

/**
 * Per-field soft validation: invalid values become undefined and are listed in
 * `issues`. Valid fields still apply. Multi-value lists keep only valid ids.
 */
export function softParseVideoDiscoverSearch(search: unknown): {
  data: VideoDiscoverSearchParams;
  issues: VideoDiscoverSearchIssue[];
} {
  const input = typeof search === "object" && search !== null ? (search as Record<string, unknown>) : {};

  const issues: VideoDiscoverSearchIssue[] = [];
  const data: VideoDiscoverSearchParams = {};

  if (input.sort != null && input.sort !== "") {
    const result = videoSortSchema.safeParse(input.sort);

    if (result.success) {
      if (result.data !== DEFAULT_VIDEO_SORT) {
        data.sort = result.data;
      }
    } else {
      issues.push(...issuesFromResult("sort", result, input.sort, `one of ${VIDEO_SORT_VALUES.join(" | ")}`));
    }
  }

  const actressRaw = input.actress != null && input.actress !== "" ? input.actress : undefined;
  const actressParsed = softParseIdList("actress", actressRaw, issues);

  if (actressParsed && actressParsed.length > 0) {
    data.actress = actressParsed;
  }

  // Accept `genre` (canonical) and accidental `genres` alias from the URL.
  const genreRaw =
    input.genre != null && input.genre !== ""
      ? input.genre
      : input.genres != null && input.genres !== ""
        ? input.genres
        : undefined;
  const genrePath = input.genre != null && input.genre !== "" ? "genre" : "genres";
  const genreParsed = softParseIdList(genrePath, genreRaw, issues);

  if (genreParsed && genreParsed.length > 0) {
    data.genre = genreParsed;
  }

  for (const key of ["maker", "label", "director", "series"] as const) {
    if (input[key] == null || input[key] === "") {
      continue;
    }

    const result = unsignedIntIdSchema.safeParse(input[key]);

    if (result.success) {
      data[key] = result.data;
    } else {
      issues.push(...issuesFromResult(key, result, input[key], "an unsigned integer"));
    }
  }

  if (input.features_cnt != null && input.features_cnt !== "") {
    const raw =
      typeof input.features_cnt === "string" || typeof input.features_cnt === "number"
        ? String(input.features_cnt).trim()
        : null;

    if (raw == null || raw === "") {
      issues.push({
        path: "features_cnt",
        message: expectedGotMessage('a features_cnt string like "2", "3,", or "1,3"', input.features_cnt),
      });
    } else {
      const parsed = parseFeaturesCnt(raw);

      if (parsed) {
        data.features_cnt = raw;
      } else {
        issues.push({
          path: "features_cnt",
          message: expectedGotMessage('a features_cnt string like "2", "3,", or "1,3"', input.features_cnt),
        });
      }
    }
  }

  return { data, issues };
}

function softParseIdList(path: string, raw: unknown, issues: VideoDiscoverSearchIssue[]): number[] | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }

  const values = Array.isArray(raw) ? raw : [raw];
  const ids: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const result = unsignedIntIdSchema.safeParse(value);

    if (result.success) {
      ids.push(result.data);
    } else {
      const suffix = values.length > 1 ? `[${index}]` : "";
      issues.push({
        path: `${path}${suffix}`,
        message: expectedGotMessage("an unsigned integer", value),
      });
    }
  }

  return ids.length > 0 ? ids : undefined;
}

/** Validate URL search without throwing (strict: any invalid field fails). */
export function parseVideoDiscoverSearch(search: unknown): VideoDiscoverSearchParseResult {
  const parsed = videoDiscoverSearchSchema.safeParse(search);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    error: parsed.error,
    issues: formatVideoDiscoverSearchIssues(parsed.error),
  };
}

export function parseFeaturesCnt(value: unknown): FeaturesCountRange | undefined {
  if (value == null) return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  // "3," → min 3, open max
  if (raw.endsWith(",")) {
    const min = Number(raw.slice(0, -1).trim());
    if (!Number.isFinite(min) || min < 0) return undefined;
    return { min: Math.floor(min) };
  }

  if (raw.includes(",")) {
    const [lo, hi] = raw.split(",", 2).map((s) => s.trim());
    const min = Number(lo);
    const max = Number(hi);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    const a = Math.floor(min);
    const b = Math.floor(max);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  const exact = Number(raw);
  if (!Number.isFinite(exact) || exact < 0) return undefined;
  const n = Math.floor(exact);
  return { min: n, max: n };
}

export function stringifyFeaturesCnt(range: FeaturesCountRange): string {
  if (range.max == null) return `${range.min},`;
  if (range.min === range.max) return String(range.min);
  return `${range.min},${range.max}`;
}

export function buildVideoDiscoverSearch(input: {
  sort?: VideoSort;
  filters?: VideoDiscoverFilters;
}): VideoDiscoverSearchParams {
  const filters = input.filters ?? DEFAULT_VIDEO_FILTERS;
  const search: VideoDiscoverSearchParams = {};

  const sort = input.sort ?? DEFAULT_VIDEO_SORT;
  if (sort !== DEFAULT_VIDEO_SORT) search.sort = sort;

  if (filters.actresses.length > 0) search.actress = filters.actresses;
  if (filters.genres.length > 0) search.genre = filters.genres;
  if (filters.maker != null) search.maker = filters.maker;
  if (filters.label != null) search.label = filters.label;
  if (filters.director != null) search.director = filters.director;
  if (filters.series != null) search.series = filters.series;
  if (filters.features_cnt != null) {
    search.features_cnt = stringifyFeaturesCnt(filters.features_cnt);
  }

  return search;
}

export function hasActiveDiscoverFilters(filters: VideoDiscoverFilters): boolean {
  return (
    filters.actresses.length > 0 ||
    filters.genres.length > 0 ||
    filters.maker != null ||
    filters.label != null ||
    filters.director != null ||
    filters.series != null ||
    filters.features_cnt != null
  );
}

function trendingScore(video: Video): number {
  const views = video.views ?? 0;
  const likes = video.likes ?? 0;
  const dislikes = video.dislikes ?? 0;
  return views + likes * 5 - dislikes * 3;
}

function releaseTime(video: Video): number {
  return video.release_date ? Date.parse(video.release_date) : 0;
}

function withinLastDays(video: Video, days: number): boolean {
  const t = releaseTime(video);
  if (!t) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

export function filterDiscoverVideos(videos: Video[], filters: VideoDiscoverFilters): Video[] {
  return videos.filter((video) => {
    if (filters.actresses.length > 0) {
      const ids = (video.actresses ?? []).map((a) => a.id);
      if (!filters.actresses.some((id) => ids.includes(id))) return false;
    }

    if (filters.genres.length > 0) {
      const ids = (video.genres ?? []).map((g) => g.id);
      if (!filters.genres.some((id) => ids.includes(id))) return false;
    }

    if (filters.maker != null && video.maker?.id !== filters.maker) return false;
    if (filters.label != null && video.label?.id !== filters.label) return false;
    if (filters.director != null && video.director?.id !== filters.director) {
      return false;
    }
    if (filters.series != null && video.series?.id !== filters.series) return false;

    if (filters.features_cnt != null) {
      const count = video.actresses?.length ?? 0;
      const { min, max } = filters.features_cnt;
      if (count < min) return false;
      if (max != null && count > max) return false;
    }

    return true;
  });
}

export function sortDiscoverVideos(videos: Video[], sort: VideoSort): Video[] {
  const list = [...videos];

  switch (sort) {
    case "trending-week": {
      const week = list.filter((v) => withinLastDays(v, 7));
      const pool = week.length > 0 ? week : list;
      return pool.sort(
        (a, b) =>
          trendingScore(b) - trendingScore(a) ||
          releaseTime(b) - releaseTime(a) ||
          a.video_id.localeCompare(b.video_id),
      );
    }
    case "trending-month": {
      const month = list.filter((v) => withinLastDays(v, 30));
      const pool = month.length > 0 ? month : list;
      return pool.sort(
        (a, b) =>
          trendingScore(b) - trendingScore(a) ||
          releaseTime(b) - releaseTime(a) ||
          a.video_id.localeCompare(b.video_id),
      );
    }
    case "trending-all":
      return list.sort(
        (a, b) =>
          trendingScore(b) - trendingScore(a) ||
          releaseTime(b) - releaseTime(a) ||
          a.video_id.localeCompare(b.video_id),
      );
    case "latest":
      return list.sort((a, b) => releaseTime(b) - releaseTime(a) || a.video_id.localeCompare(b.video_id));
    case "views":
      return list.sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || a.video_id.localeCompare(b.video_id));
    case "likes":
      return list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || a.video_id.localeCompare(b.video_id));
    default:
      return list;
  }
}

export type VideoDiscoverResult = {
  videos: Video[];
  total: number;
  sort: VideoSort;
  filters: VideoDiscoverFilters;
};

export async function getDiscoverVideos(
  options: {
    sort?: VideoSort;
    filters?: VideoDiscoverFilters;
    videos?: Video[];
  } = {},
): Promise<VideoDiscoverResult> {
  const sort = options.sort ?? DEFAULT_VIDEO_SORT;
  const filters = options.filters ?? DEFAULT_VIDEO_FILTERS;
  const source = options.videos ?? mockVideos;
  const filtered = filterDiscoverVideos(source, filters);
  const sorted = sortDiscoverVideos(filtered, sort);

  return {
    videos: sorted,
    total: sorted.length,
    sort,
    filters,
  };
}

function collectNamed(
  videos: Video[],
  pick: (video: Video) => NamedEntity | NamedEntity[] | null | undefined,
): NamedEntity[] {
  const map = new Map<number, string>();
  for (const video of videos) {
    const value = pick(video);
    if (!value) continue;
    const list = Array.isArray(value) ? value : [value];
    for (const item of list) {
      map.set(item.id, item.name);
    }
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableDiscoverActresses(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.actresses ?? []);
}

export function getAvailableDiscoverGenres(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.genres ?? []);
}

export function getAvailableDiscoverMakers(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.maker ?? null);
}

export function getAvailableDiscoverLabels(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.label ?? null);
}

export function getAvailableDiscoverDirectors(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.director ?? null);
}

export function getAvailableDiscoverSeries(videos: Video[] = mockVideos): NamedEntity[] {
  return collectNamed(videos, (v) => v.series ?? null);
}
