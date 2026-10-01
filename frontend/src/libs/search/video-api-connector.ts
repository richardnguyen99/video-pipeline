/**
 * Search UI–compatible connector for videos.
 *
 * Posts to FastAPI proxy endpoints (`/search-ui/videos/search` and
 * `/search-ui/videos/autocomplete`) so the browser never talks to Elasticsearch.
 *
 * @see https://www.elastic.co/docs/reference/search-ui/tutorials-elasticsearch-production-usage
 * @see https://www.elastic.co/docs/reference/search-ui/guides-building-custom-connector
 */

import { getApiBaseUrl } from "@/libs/api-client";

export type SearchRequestState = {
  searchTerm?: string;
  current?: number;
  resultsPerPage?: number;
};

export type SearchResultField = {
  raw?: string | number | null | Array<string | number | null>;
  snippet?: string;
};

export type SearchResult = {
  id: { raw: string };
  video_id?: SearchResultField;
  title?: SearchResultField;
  release_date?: SearchResultField;
  actress_names?: SearchResultField;
  genre_names?: SearchResultField;
  image_url?: SearchResultField;
  [key: string]: SearchResultField | { raw: string } | undefined;
};

export type SearchResponseState = {
  results: Array<SearchResult>;
  totalResults: number;
  totalPages: number;
  resultSearchTerm?: string;
};

export type AutocompleteSuggestion = {
  suggestion: string;
};

export type AutocompleteResponseState = {
  autocompletedResults: Array<SearchResult>;
  autocompletedSuggestions: Record<string, Array<AutocompleteSuggestion>>;
};

type ProxyBody = {
  state: {
    searchTerm: string;
    current: number;
    resultsPerPage: number;
  };
  queryConfig: {
    resultsPerPage?: number;
    results?: { resultsPerPage?: number };
  };
};

async function postSearchUi<T>(path: string, body: ProxyBody): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`Search UI proxy failed (${response.status}): ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

function toProxyBody(state: SearchRequestState, options?: { autocompleteSize?: number }): ProxyBody {
  const searchTerm = (state.searchTerm ?? "").trim();
  const resultsPerPage = Math.min(Math.max(state.resultsPerPage ?? 20, 1), 100);
  const current = Math.max(state.current ?? 1, 1);

  return {
    state: {
      searchTerm,
      current,
      resultsPerPage,
    },
    queryConfig: {
      resultsPerPage,
      results: options?.autocompleteSize ? { resultsPerPage: options.autocompleteSize } : undefined,
    },
  };
}

/**
 * Connector implementing the Search UI ``APIConnector`` surface for videos.
 *
 * Pair with ``ApiProxyConnector``-style base path:
 * ``${API}/search-ui/videos`` → ``/search`` + ``/autocomplete``.
 */
export class VideoApiConnector {
  async onSearch(state: SearchRequestState): Promise<SearchResponseState> {
    const searchTerm = (state.searchTerm ?? "").trim();

    if (!searchTerm) {
      return {
        results: [],
        totalResults: 0,
        totalPages: 0,
      };
    }

    return postSearchUi<SearchResponseState>("/search-ui/videos/search", toProxyBody(state));
  }

  async onAutocomplete(state: SearchRequestState): Promise<AutocompleteResponseState> {
    const searchTerm = (state.searchTerm ?? "").trim();

    if (searchTerm.length < 2) {
      return {
        autocompletedResults: [],
        autocompletedSuggestions: { documents: [] },
      };
    }

    return postSearchUi<AutocompleteResponseState>(
      "/search-ui/videos/autocomplete",
      toProxyBody(state, { autocompleteSize: 6 }),
    );
  }

  onResultClick(): void {}

  onAutocompleteResultClick(): void {}
}

export const videoApiConnector = new VideoApiConnector();
