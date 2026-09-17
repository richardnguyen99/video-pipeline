/**
 * Custom Search UI–style connector that proxies through FastAPI.
 *
 * Mirrors Elastic Search UI's production pattern: the browser never talks to
 * Elasticsearch directly. FastAPI `/videos?q=` runs the ES-backed search.
 *
 * @see https://www.elastic.co/docs/reference/search-ui/guides-building-custom-connector
 */

import { apiFetch } from "@/libs/api-client";
import type { Video } from "@/mocks/videos";
import { pickVideoImageUrl } from "@/mocks/videos";
import type { VideoListApiResponse } from "@/queries/videos";

export type SearchRequestState = {
  searchTerm?: string;
  current?: number;
  resultsPerPage?: number;
};

export type SearchResultField = {
  raw?: string | number | null;
  snippet?: string;
};

export type SearchResult = {
  id: { raw: string };
  video_id: SearchResultField;
  title: SearchResultField;
  release_date: SearchResultField;
  image_url: SearchResultField;
};

export type SearchResponseState = {
  results: SearchResult[];
  totalResults: number;
  totalPages: number;
  requestId?: string;
};

export type AutocompleteSuggestion = {
  suggestion: string;
};

export type AutocompleteResponseState = {
  results: {
    documents?: SearchResult[];
  };
  autocompletedResults: SearchResult[];
  autocompletedSuggestions: Record<string, AutocompleteSuggestion[]>;
};

function toSearchResult(video: Video): SearchResult {
  return {
    id: { raw: String(video.id) },
    video_id: { raw: video.video_id },
    title: { raw: video.title },
    release_date: { raw: video.release_date ?? null },
    image_url: { raw: pickVideoImageUrl(video.video_image_url) ?? null },
  };
}

/**
 * Connector implementing the Search UI `APIConnector` surface for video search.
 */
export class VideoApiConnector {
  async onSearch(state: SearchRequestState): Promise<SearchResponseState> {
    const searchTerm = (state.searchTerm ?? "").trim();
    const resultsPerPage = Math.min(Math.max(state.resultsPerPage ?? 16, 1), 100);
    const current = Math.max(state.current ?? 1, 1);
    const offset = (current - 1) * resultsPerPage;

    if (!searchTerm) {
      return {
        results: [],
        totalResults: 0,
        totalPages: 0,
      };
    }

    const response = await apiFetch<VideoListApiResponse>("/videos", {
      searchParams: {
        q: searchTerm,
        limit: resultsPerPage,
        offset,
      },
    });

    const totalResults = response.total;
    const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

    return {
      results: response.items.map(toSearchResult),
      totalResults,
      totalPages,
    };
  }

  async onAutocomplete(state: SearchRequestState): Promise<AutocompleteResponseState> {
    const searchTerm = (state.searchTerm ?? "").trim();

    if (searchTerm.length < 2) {
      return {
        results: {},
        autocompletedResults: [],
        autocompletedSuggestions: { documents: [] },
      };
    }

    const response = await apiFetch<VideoListApiResponse>("/videos", {
      searchParams: {
        q: searchTerm,
        limit: 6,
        offset: 0,
      },
    });

    const documents = response.items.map(toSearchResult);
    const suggestions = response.items
      .map((item) => item.title.trim())
      .filter((title) => title.length > 0)
      .slice(0, 5)
      .map((suggestion) => ({ suggestion }));

    return {
      results: { documents },
      autocompletedResults: documents,
      autocompletedSuggestions: { documents: suggestions },
    };
  }

  onResultClick(): void {}

  onAutocompleteResultClick(): void {}
}

export const videoApiConnector = new VideoApiConnector();
