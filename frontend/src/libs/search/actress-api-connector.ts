/**
 * Search UI–compatible connector for actresses.
 *
 * Posts to FastAPI proxy endpoints (`/search-ui/actresses/search` and
 * `/search-ui/actresses/autocomplete`).
 *
 * @see https://www.elastic.co/docs/reference/search-ui/tutorials-elasticsearch-production-usage
 */

import { getApiBaseUrl } from "@/libs/api-client";

export type ActressSearchRequestState = {
  searchTerm?: string;
  current?: number;
  resultsPerPage?: number;
};

export type ActressSearchResultField = {
  raw?: string | number | null | Array<string | number | null>;
  snippet?: string;
};

export type ActressSearchResult = {
  id: { raw: string };
  name?: ActressSearchResultField;
  original_name?: ActressSearchResultField;
  ruby?: ActressSearchResultField;
  aka_translated_names?: ActressSearchResultField;
  [key: string]: ActressSearchResultField | { raw: string } | undefined;
};

export type ActressSearchResponseState = {
  results: ActressSearchResult[];
  totalResults: number;
  totalPages: number;
  resultSearchTerm?: string;
};

export type ActressAutocompleteSuggestion = {
  suggestion: string;
};

export type ActressAutocompleteResponseState = {
  autocompletedResults: ActressSearchResult[];
  autocompletedSuggestions: Record<string, ActressAutocompleteSuggestion[]>;
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

function toProxyBody(state: ActressSearchRequestState, options?: { autocompleteSize?: number }): ProxyBody {
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

export class ActressApiConnector {
  async onSearch(state: ActressSearchRequestState): Promise<ActressSearchResponseState> {
    const searchTerm = (state.searchTerm ?? "").trim();

    if (!searchTerm) {
      return {
        results: [],
        totalResults: 0,
        totalPages: 0,
      };
    }

    return postSearchUi<ActressSearchResponseState>("/search-ui/actresses/search", toProxyBody(state));
  }

  async onAutocomplete(state: ActressSearchRequestState): Promise<ActressAutocompleteResponseState> {
    const searchTerm = (state.searchTerm ?? "").trim();

    if (searchTerm.length < 2) {
      return {
        autocompletedResults: [],
        autocompletedSuggestions: { documents: [] },
      };
    }

    return postSearchUi<ActressAutocompleteResponseState>(
      "/search-ui/actresses/autocomplete",
      toProxyBody(state, { autocompleteSize: 6 }),
    );
  }

  onResultClick(): void {}

  onAutocompleteResultClick(): void {}
}

export const actressApiConnector = new ActressApiConnector();
