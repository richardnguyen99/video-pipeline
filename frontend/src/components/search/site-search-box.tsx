/**
 * Header search box with Elastic Search UI autocomplete.
 * Enter → /videos?q=… (or active result → /videos/$id);
 * Mod+K focuses the bar; Esc closes the panel.
 *
 * Uses a relative/absolute dropdown (not Popover) so the panel matches the
 * input width and does not reposition on page scroll.
 *
 * Anonymous search history (localStorage): recent queries + up to 5 videos.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useHotkey, formatForDisplay } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Loader2, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SearchResult } from "@/libs/search/video-api-connector";
import { videoApiConnector } from "@/libs/search/video-api-connector";
import {
  clearSearchQueries,
  clearSearchVideos,
  mergeRecentVideosOnTop,
  readSearchHistory,
  recentVideoToSearchResult,
  rememberSearchQuery,
  rememberSearchVideo,
  removeSearchQuery,
  removeSearchVideo,
} from "@/libs/search/search-history";
import type { SearchHistoryState } from "@/libs/search/search-history";
import { cn } from "@/libs/utils";

const DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

const HISTORY_TOOLTIP_CLASS = cn(
  "z-[200] rounded-full border border-primary/25 bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-md",
);

type SiteSearchBoxProps = {
  className?: string;
  compact?: boolean;
  defaultValue?: string;
  onNavigate?: () => void;
  /** Register global Mod+K to focus this instance (desktop header only). */
  enableHotkey?: boolean;
};

type PanelMode = "history" | "autocomplete";

export function SiteSearchBox({
  className,
  compact = false,
  defaultValue = "",
  onNavigate,
  enableHotkey = false,
}: SiteSearchBoxProps) {
  const navigate = useNavigate();

  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [history, setHistory] = useState<SearchHistoryState>(() => readSearchHistory());

  const term = value.trim();
  const canSearch = term.length >= MIN_QUERY_LENGTH;
  const hasHistory = history.queries.length > 0 || history.videos.length > 0;
  const panelMode: PanelMode = canSearch ? "autocomplete" : "history";

  const { orderedResults, recentIds } = useMemo(() => {
    if (!canSearch) {
      return {
        orderedResults: [] as SearchResult[],
        recentIds: new Set<string>(),
      };
    }

    const merged = mergeRecentVideosOnTop(results, history.videos, term);

    return {
      orderedResults: merged.results,
      recentIds: merged.recentIds,
    };
  }, [canSearch, results, history.videos, term]);

  const historyVideos = history.videos;
  const historyQueries = history.queries;

  const historyVideoResults = useMemo(() => historyVideos.map(recentVideoToSearchResult), [historyVideos]);

  const visibleResults = panelMode === "autocomplete" ? orderedResults : historyVideoResults;
  const visibleLoading = canSearch && loading;
  const showHistoryPanel = open && panelMode === "history" && hasHistory;
  const showAutocompletePanel = open && panelMode === "autocomplete";
  const showPanel = showHistoryPanel || showAutocompletePanel;

  const queryOptionCount = panelMode === "history" ? historyQueries.length : 0;
  const videoOptionCount = visibleResults.length;
  const searchAllIndex = panelMode === "autocomplete" ? queryOptionCount + videoOptionCount : -1;
  const optionCount =
    panelMode === "history" ? queryOptionCount + videoOptionCount : queryOptionCount + videoOptionCount + 1;

  const deactivateSearch = useCallback(() => {
    requestIdRef.current += 1;
    setOpen(false);
    setActiveIndex(-1);
    setValue("");
    setResults([]);
    setLoading(false);
    inputRef.current?.blur();
  }, []);

  const goToResults = useCallback(
    (nextTerm: string) => {
      const q = nextTerm.trim();

      if (!q) {
        return;
      }

      setHistory(rememberSearchQuery(q));
      deactivateSearch();
      onNavigate?.();
      void navigate({
        to: "/videos",
        search: { q },
        replace: false,
      });
    },
    [deactivateSearch, navigate, onNavigate],
  );

  const removeHistoryQuery = useCallback((query: string) => {
    setHistory(removeSearchQuery(query));
    setActiveIndex(-1);
    toast.add({
      type: "info",
      title: "Search removed",
      description: `“${query}” was removed from recent searches.`,
      timeout: 5000,
    });
  }, []);

  const removeHistoryVideo = useCallback((id: string, label?: string) => {
    setHistory(removeSearchVideo(id));
    setActiveIndex(-1);
    toast.add({
      type: "info",
      title: "Video removed",
      description: label ? `“${label}” was removed from recent videos.` : "Removed from recent videos.",
      timeout: 5000,
    });
  }, []);

  const clearAllHistoryQueries = useCallback(() => {
    setHistory(clearSearchQueries());
    setActiveIndex(-1);
    toast.add({
      type: "warning",
      title: "Searches cleared",
      description: "All recent searches were removed.",
      timeout: 5000,
    });
  }, []);

  const clearAllHistoryVideos = useCallback(() => {
    setHistory(clearSearchVideos());
    setActiveIndex(-1);
    toast.add({
      type: "warning",
      title: "Videos cleared",
      description: "All recent videos were removed.",
      timeout: 5000,
    });
  }, []);

  const goToVideo = useCallback(
    (result: SearchResult) => {
      const q = value.trim();

      if (q.length > 0) {
        rememberSearchQuery(q);
      }

      setHistory(rememberSearchVideo(result));
      deactivateSearch();
      onNavigate?.();
      void navigate({
        to: "/videos/$id",
        params: { id: result.id.raw },
      });
    },
    [deactivateSearch, navigate, onNavigate, value],
  );

  const focusSearch = useCallback(() => {
    const input = inputRef.current;

    if (input == null) {
      return;
    }

    input.focus();
    input.select();

    if (canSearch && orderedResults.length > 0) {
      setOpen(true);
    } else if (!canSearch && hasHistory) {
      setOpen(true);
    }
  }, [canSearch, orderedResults.length, hasHistory]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useHotkey("Mod+K", focusSearch, {
    enabled: enableHotkey,
    preventDefault: true,
  });

  useHotkey("Escape", closePanel, {
    enabled: showPanel,
    preventDefault: true,
  });

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setLoading(true);

      void videoApiConnector
        .onAutocomplete({ searchTerm: term })
        .then((response) => {
          if (cancelled || requestId !== requestIdRef.current) {
            return;
          }

          setResults(response.autocompletedResults);
          setOpen(true);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (cancelled || requestId !== requestIdRef.current) {
            return;
          }

          setResults([]);
        })
        .finally(() => {
          if (!cancelled && requestId === requestIdRef.current) {
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSearch, term]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", onPointerDown);

    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function resolveOption(index: number): {
    kind: "query" | "video" | "search-all";
    query?: string;
    video?: SearchResult;
  } | null {
    if (index < 0) {
      return null;
    }

    if (panelMode === "history") {
      if (index < queryOptionCount) {
        return { kind: "query", query: historyQueries[index] };
      }

      const videoIndex = index - queryOptionCount;
      const video = visibleResults.at(videoIndex);

      if (video != null) {
        return { kind: "video", video };
      }

      return null;
    }

    if (index < videoOptionCount) {
      const video = visibleResults.at(index);

      if (video != null) {
        return { kind: "video", video };
      }

      return null;
    }

    if (index === searchAllIndex) {
      return { kind: "search-all" };
    }

    return null;
  }

  function activateOption(index: number) {
    const option = resolveOption(index);

    if (option == null) {
      goToResults(value);

      return;
    }

    if (option.kind === "query" && option.query != null) {
      goToResults(option.query);

      return;
    }

    if (option.kind === "video" && option.video != null) {
      goToVideo(option.video);

      return;
    }

    goToResults(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (showPanel && activeIndex >= 0) {
      activateOption(activeIndex);

      return;
    }

    goToResults(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();

      return;
    }

    if (!showPanel) {
      return;
    }

    if (optionCount === 0) {
      if (event.key === "Enter") {
        event.preventDefault();
        goToResults(value);
      }

      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => {
        if (index < 0) {
          return 0;
        }

        return (index + 1) % optionCount;
      });

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => {
        if (index < 0) {
          return optionCount - 1;
        }

        return index === 0 ? optionCount - 1 : index - 1;
      });

      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (activeIndex >= 0) {
        activateOption(activeIndex);

        return;
      }

      goToResults(value);
    }
  }

  function handleClear() {
    setValue("");
    setResults([]);
    setActiveIndex(-1);
    setLoading(false);

    if (hasHistory) {
      setOpen(true);
    } else {
      setOpen(false);
    }

    inputRef.current?.focus();
  }

  function handleFocus() {
    if (canSearch && (results.length > 0 || orderedResults.length > 0)) {
      setOpen(true);

      return;
    }

    if (!canSearch && hasHistory) {
      setOpen(true);
    }
  }

  const hotkeyLabel = formatForDisplay("Mod+K");
  const searchAllActive = activeIndex === searchAllIndex;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} role="search" className="relative w-full">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />

        <Input
          ref={inputRef}
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={`Search… (${hotkeyLabel})`}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          className={cn(
            "h-9 w-full border-border/80 bg-background/80 pr-9 pl-9 shadow-none",
            compact ? "min-w-48 sm:min-w-56 lg:min-w-72" : null,
          )}
        />

        {visibleLoading ? (
          <Loader2
            className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>

      {showHistoryPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="max-h-80 overflow-y-auto py-1">
            {historyQueries.length > 0 ? (
              <div>
                <div className="group/queries relative flex items-center gap-2 px-3 py-1.5">
                  <p className="min-w-0 flex-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Recent searches
                  </p>

                  <div className="opacity-0 transition-opacity group-hover/queries:opacity-100 focus-within:opacity-100">
                    <Tooltip disableHoverablePopup>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Clear all recent searches"
                            className={cn(
                              "size-7 shrink-0 p-1.5 text-muted-foreground",
                              "hover:bg-destructive/15 hover:text-destructive",
                              "focus-visible:ring-destructive/30",
                              "active:translate-y-0",
                            )}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              clearAllHistoryQueries();
                            }}
                          />
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </TooltipTrigger>

                      <TooltipContent side="bottom" sideOffset={6} className={HISTORY_TOOLTIP_CLASS}>
                        Clear all recent searches
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <ul>
                  {historyQueries.map((query, index) => {
                    const active = index === activeIndex;

                    return (
                      <li
                        key={`q-${query}`}
                        id={`${listId}-option-${index}`}
                        role="option"
                        aria-selected={active}
                        className="group/query relative"
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 pr-10 text-left text-sm transition-colors",
                            active ? "bg-muted" : "hover:bg-muted/70",
                          )}
                          onClick={() => goToResults(query)}
                        >
                          <Clock className="size-4 shrink-0 text-muted-foreground" />

                          <span className="min-w-0 flex-1 truncate font-medium">{query}</span>
                        </button>

                        <div
                          className={cn(
                            "absolute top-1/2 right-1.5 z-10 -translate-y-1/2",
                            "opacity-0 transition-opacity",
                            "group-hover/query:opacity-100 focus-within:opacity-100",
                            active ? "opacity-100" : null,
                          )}
                        >
                          <Tooltip disableHoverablePopup>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Remove search “${query}”`}
                                  className={cn(
                                    "size-7 p-1.5 text-muted-foreground",
                                    "hover:bg-destructive/15 hover:text-destructive",
                                    "focus-visible:ring-destructive/30",
                                    "active:translate-y-0",
                                  )}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    removeHistoryQuery(query);
                                  }}
                                />
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </TooltipTrigger>

                            <TooltipContent side="left" sideOffset={6} className={HISTORY_TOOLTIP_CLASS}>
                              Remove this search
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {historyVideoResults.length > 0 ? (
              <div>
                <div
                  className={cn(
                    "group/videos relative flex items-center gap-2 px-3 py-1.5",
                    historyQueries.length > 0 ? "mt-1 border-t border-border pt-2" : null,
                  )}
                >
                  <p className="min-w-0 flex-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Recent videos
                  </p>

                  <div className="opacity-0 transition-opacity group-hover/videos:opacity-100 focus-within:opacity-100">
                    <Tooltip disableHoverablePopup>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Clear all recent videos"
                            className={cn(
                              "size-7 shrink-0 p-1.5 text-muted-foreground",
                              "hover:bg-destructive/15 hover:text-destructive",
                              "focus-visible:ring-destructive/30",
                              "active:translate-y-0",
                            )}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              clearAllHistoryVideos();
                            }}
                          />
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </TooltipTrigger>

                      <TooltipContent side="bottom" sideOffset={6} className={HISTORY_TOOLTIP_CLASS}>
                        Clear all recent videos
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <ul>
                  {historyVideoResults.map((result, videoIndex) => {
                    const index = queryOptionCount + videoIndex;
                    const active = index === activeIndex;
                    const title = String(result.title?.raw ?? "");
                    const code = String(result.video_id?.raw ?? "");
                    const imageRaw = result.image_url?.raw;
                    const image = imageRaw != null && imageRaw !== "" ? String(imageRaw) : null;

                    return (
                      <li
                        key={`v-${result.id.raw}`}
                        id={`${listId}-option-${index}`}
                        role="option"
                        aria-selected={active}
                        className="group/video relative"
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 border-l-2 px-3 py-2 pr-11 text-left text-sm transition-colors",
                            "border-l-primary/70 bg-primary/5",
                            active ? "bg-primary/15" : "hover:bg-primary/10",
                          )}
                          onClick={() => goToVideo(result)}
                        >
                          {image ? (
                            <img src={image} alt="" className="size-10 shrink-0 rounded object-cover" loading="lazy" />
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                              <Search className="size-4" />
                            </span>
                          )}

                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 font-medium">{title}</span>

                            <span className="mt-0.5 block text-xs text-muted-foreground">{code}</span>
                          </span>
                        </button>

                        <div
                          className={cn(
                            "absolute top-1/2 right-1.5 z-10 -translate-y-1/2",
                            "opacity-0 transition-opacity",
                            "group-hover/video:opacity-100 focus-within:opacity-100",
                            active ? "opacity-100" : null,
                          )}
                        >
                          <Tooltip disableHoverablePopup>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Remove recent video “${title}”`}
                                  className={cn(
                                    "size-7 p-1.5 text-muted-foreground",
                                    "hover:bg-destructive/15 hover:text-destructive",
                                    "focus-visible:ring-destructive/30",
                                    "active:translate-y-0",
                                  )}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    removeHistoryVideo(result.id.raw, code || title);
                                  }}
                                />
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </TooltipTrigger>

                            <TooltipContent side="left" sideOffset={6} className={HISTORY_TOOLTIP_CLASS}>
                              Remove this video
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showAutocompletePanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {visibleResults.length === 0 && !visibleLoading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matches</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {visibleResults.map((result, index) => {
                const title = String(result.title?.raw ?? "");
                const code = String(result.video_id?.raw ?? "");
                const imageRaw = result.image_url?.raw;
                const image = imageRaw != null && imageRaw !== "" ? String(imageRaw) : null;
                const active = index === activeIndex;
                const isRecent = recentIds.has(result.id.raw);

                return (
                  <li key={result.id.raw} id={`${listId}-option-${index}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        isRecent
                          ? cn(
                              "border-l-2 border-l-primary/70 bg-primary/5",
                              active ? "bg-primary/15" : "hover:bg-primary/10",
                            )
                          : active
                            ? "bg-muted"
                            : "hover:bg-muted/70",
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goToVideo(result)}
                    >
                      {image ? (
                        <img src={image} alt="" className="size-10 shrink-0 rounded object-cover" loading="lazy" />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                          <Search className="size-4" />
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 font-medium">{title}</span>

                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {code}

                          {isRecent ? (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Recent
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
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
            onMouseEnter={() => setActiveIndex(searchAllIndex)}
            onClick={() => goToResults(value)}
          >
            <Search className="size-3.5" />
            Search all results for “{term}”
          </button>
        </div>
      ) : null}
    </div>
  );
}
