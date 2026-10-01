import type { RecentQuery } from "@/libs/search/search-history";
import type { SearchResult } from "@/libs/search/video-api-connector";
import { cn } from "@/libs/utils";

import { PANEL_CLASS } from "./constants";
import { HistoryQueryItem } from "./history-query-item";
import { HistorySectionHeader } from "./history-section-header";
import { SearchResultItem } from "./search-result-item";

interface HistoryPanelProps {
  listId: string;
  queries: Array<RecentQuery>;
  videos: Array<SearchResult>;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelectQuery: (query: string) => void;
  onSelectVideo: (result: SearchResult) => void;
  onToggleFavorite: (query: string) => void;
  onRemoveQuery: (query: string) => void;
  onRemoveVideo: (id: string, label: string) => void;
  onClearQueries: () => void;
  onClearVideos: () => void;
}

export function HistoryPanel({
  listId,
  queries,
  videos,
  activeIndex,
  onActiveIndexChange,
  onSelectQuery,
  onSelectVideo,
  onToggleFavorite,
  onRemoveQuery,
  onRemoveVideo,
  onClearQueries,
  onClearVideos,
}: HistoryPanelProps) {
  const queryCount = queries.length;

  return (
    <div id={listId} role="listbox" className={PANEL_CLASS}>
      <div className="max-h-80 overflow-y-auto py-1">
        {queries.length > 0 ? (
          <div>
            <HistorySectionHeader
              title="Recent searches"
              clearLabel="Clear all recent searches"
              clearTooltip="Clear all recent searches"
              groupClass="group/queries"
              onClear={onClearQueries}
            />

            <ul>
              {queries.map((entry, index) => (
                <HistoryQueryItem
                  key={`q-${entry.query}`}
                  entry={entry}
                  optionId={`${listId}-option-${index}`}
                  active={index === activeIndex}
                  onSelect={() => onSelectQuery(entry.query)}
                  onMouseEnter={() => onActiveIndexChange(index)}
                  onToggleFavorite={() => onToggleFavorite(entry.query)}
                  onRemove={() => onRemoveQuery(entry.query)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {videos.length > 0 ? (
          <div>
            <HistorySectionHeader
              title="Recent videos"
              clearLabel="Clear all recent videos"
              clearTooltip="Clear all recent videos"
              groupClass="group/videos"
              className={cn(queries.length > 0 ? "mt-1 border-t border-border pt-2" : null)}
              onClear={onClearVideos}
            />

            <ul>
              {videos.map((result, videoIndex) => {
                const index = queryCount + videoIndex;

                return (
                  <SearchResultItem
                    key={`v-${result.id.raw}`}
                    result={result}
                    optionId={`${listId}-option-${index}`}
                    active={index === activeIndex}
                    isRecent
                    showDelete
                    onSelect={() => onSelectVideo(result)}
                    onMouseEnter={() => onActiveIndexChange(index)}
                    onDelete={(label) => onRemoveVideo(result.id.raw, label)}
                  />
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
