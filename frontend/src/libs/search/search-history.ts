/**
 * Anonymous search history persisted in localStorage.
 * Stores recent query strings and recently selected videos.
 */

import type { SearchResult } from "@/libs/search/video-api-connector";

const STORAGE_KEY = "velvet.search.history.v1";
const MAX_QUERIES = 15;
const MAX_VIDEOS = 5;

export type RecentVideo = {
  id: string;
  video_id: string;
  title: string;
  image_url: string | null;
};

export type SearchHistoryState = {
  queries: string[];
  videos: RecentVideo[];
};

const EMPTY: SearchHistoryState = {
  queries: [],
  videos: [],
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isRecentVideo(value: unknown): value is RecentVideo {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.video_id === "string" &&
    typeof item.title === "string" &&
    (item.image_url === null || typeof item.image_url === "string")
  );
}

function normalize(raw: unknown): SearchHistoryState {
  if (raw == null || typeof raw !== "object") {
    return { ...EMPTY };
  }

  const record = raw as Record<string, unknown>;
  const queries = Array.isArray(record.queries)
    ? record.queries
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
        .slice(0, MAX_QUERIES)
    : [];
  const videos = Array.isArray(record.videos) ? record.videos.filter(isRecentVideo).slice(0, MAX_VIDEOS) : [];

  return { queries, videos };
}

export function readSearchHistory(): SearchHistoryState {
  if (!isBrowser()) {
    return { ...EMPTY };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw == null || raw === "") {
      return { ...EMPTY };
    }

    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return { ...EMPTY };
  }
}

function writeSearchHistory(state: SearchHistoryState): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function rememberSearchQuery(query: string): SearchHistoryState {
  const q = query.trim();

  if (q.length === 0) {
    return readSearchHistory();
  }

  const current = readSearchHistory();
  const queries = [q, ...current.queries.filter((item) => item !== q)].slice(0, MAX_QUERIES);
  const next = { ...current, queries };
  writeSearchHistory(next);

  return next;
}

export function rememberSearchVideo(result: SearchResult): SearchHistoryState {
  const id = result.id.raw;
  const videoId = String(result.video_id?.raw ?? "");
  const title = String(result.title?.raw ?? "");
  const imageRaw = result.image_url?.raw;
  const image_url = imageRaw != null && imageRaw !== "" ? String(imageRaw) : null;

  if (id === "" || title === "") {
    return readSearchHistory();
  }

  const entry: RecentVideo = {
    id,
    video_id: videoId,
    title,
    image_url,
  };
  const current = readSearchHistory();
  const videos = [entry, ...current.videos.filter((item) => item.id !== id)].slice(0, MAX_VIDEOS);
  const next = { ...current, videos };
  writeSearchHistory(next);

  return next;
}

export function removeSearchQuery(query: string): SearchHistoryState {
  const q = query.trim();

  if (q.length === 0) {
    return readSearchHistory();
  }

  const current = readSearchHistory();
  const queries = current.queries.filter((item) => item !== q);
  const next = { ...current, queries };
  writeSearchHistory(next);

  return next;
}

export function clearSearchQueries(): SearchHistoryState {
  const current = readSearchHistory();
  const next = { ...current, queries: [] };
  writeSearchHistory(next);

  return next;
}

export function clearSearchHistory(): SearchHistoryState {
  writeSearchHistory({ ...EMPTY });

  return { ...EMPTY };
}

export function recentVideoToSearchResult(video: RecentVideo): SearchResult {
  return {
    id: { raw: video.id },
    video_id: { raw: video.video_id },
    title: { raw: video.title },
    image_url: { raw: video.image_url },
  };
}

/**
 * Reorder autocomplete hits so recently selected videos that Elasticsearch
 * already returned for this query sit at the top, and collect their ids for
 * the "Recent" badge. Does not invent extra hits from local history — ES is
 * the source of truth for whether a video matches the full query (e.g.
 * `julia+sweat` must not surface a `julia+squirt`-only recent item).
 */
export function mergeRecentVideosOnTop(
  results: SearchResult[],
  recent: RecentVideo[],
  _term: string,
): { results: SearchResult[]; recentIds: Set<string> } {
  const allRecentIds = new Set(recent.map((video) => video.id));
  const pinned = results.filter((result) => allRecentIds.has(result.id.raw));
  const rest = results.filter((result) => !allRecentIds.has(result.id.raw));
  const recentIds = new Set(pinned.map((result) => result.id.raw));

  return {
    results: [...pinned, ...rest],
    recentIds,
  };
}
