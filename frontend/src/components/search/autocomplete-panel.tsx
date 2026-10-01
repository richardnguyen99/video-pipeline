import { Search } from "lucide-react";

import type { SearchResult } from "@/libs/search/video-api-connector";
import { cn } from "@/libs/utils";

import { PANEL_CLASS } from "./constants";
import { SearchResultItem } from "./search-result-item";

interface AutocompletePanelProps {
  listId: string;
  term: string;
  results: Array<SearchResult>;
  recentIds: Set<string>;
  loading: boolean;
  activeIndex: number;
  searchAllIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelectVideo: (result: SearchResult) => void;
  onSearchAll: () => void;
}

export function AutocompletePanel({
  listId,
  term,
  results,
  recentIds,
  loading,
  activeIndex,
  searchAllIndex,
  onActiveIndexChange,
  onSelectVideo,
  onSearchAll,
}: AutocompletePanelProps) {
  const searchAllActive = activeIndex === searchAllIndex;

  return (
    <div id={listId} role="listbox" className={PANEL_CLASS}>
      {results.length === 0 && !loading ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">No matches</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.map((result, index) => (
            <SearchResultItem
              key={result.id.raw}
              result={result}
              optionId={`${listId}-option-${index}`}
              active={index === activeIndex}
              isRecent={recentIds.has(result.id.raw)}
              onSelect={() => onSelectVideo(result)}
              onMouseEnter={() => onActiveIndexChange(index)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        id={`${listId}-option-${searchAllIndex}`}
        role="option"
        aria-selected={searchAllActive}
        className={cn(
          "flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-primary",
          searchAllActive ? "bg-muted" : "hover:bg-muted/60",
        )}
        onMouseEnter={() => onActiveIndexChange(searchAllIndex)}
        onClick={onSearchAll}
      >
        <Search className="size-3.5" />
        Search all results for “{term}”
      </button>
    </div>
  );
}
