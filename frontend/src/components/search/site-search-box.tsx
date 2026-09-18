/**
 * Header search box with Elastic Search UI autocomplete.
 * Enter → /videos?q=… (or active result → /videos/$id);
 * Mod+K focuses the bar; Esc closes the panel.
 *
 * Uses a relative/absolute dropdown (not Popover) so the panel matches the
 * input width and does not reposition on page scroll.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useHotkey, formatForDisplay } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/libs/search/video-api-connector";
import { videoApiConnector } from "@/libs/search/video-api-connector";
import { cn } from "@/libs/utils";

const DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

type SiteSearchBoxProps = {
  className?: string;
  compact?: boolean;
  defaultValue?: string;
  onNavigate?: () => void;
  /** Register global Mod+K to focus this instance (desktop header only). */
  enableHotkey?: boolean;
};

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

  const term = value.trim();
  const canSearch = term.length >= MIN_QUERY_LENGTH;
  const visibleResults = canSearch ? results : [];
  const visibleLoading = canSearch && loading;
  const showPanel = open && canSearch;

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

      deactivateSearch();
      onNavigate?.();
      void navigate({
        to: "/videos",
        search: { q },
      });
    },
    [deactivateSearch, navigate, onNavigate],
  );

  const goToVideo = useCallback(
    (result: SearchResult) => {
      deactivateSearch();
      onNavigate?.();
      void navigate({
        to: "/videos/$id",
        params: { id: result.id.raw },
      });
    },
    [deactivateSearch, navigate, onNavigate],
  );

  const focusSearch = useCallback(() => {
    const input = inputRef.current;

    if (input == null) {
      return;
    }

    input.focus();
    input.select();

    if (canSearch && results.length > 0) {
      setOpen(true);
    }
  }, [canSearch, results.length]);

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

  const searchAllIndex = visibleResults.length;
  const optionCount = visibleResults.length + 1;
  const searchAllActive = activeIndex === searchAllIndex;

  function activateOption(index: number) {
    if (index < 0 || index === searchAllIndex) {
      goToResults(value);

      return;
    }

    const selected = visibleResults.at(index);

    if (selected != null) {
      goToVideo(selected);
    }
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

    if (visibleResults.length === 0) {
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
          return searchAllIndex;
        }

        return index === 0 ? searchAllIndex : index - 1;
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
    setOpen(false);
    setActiveIndex(-1);
    setLoading(false);
    inputRef.current?.focus();
  }

  const hotkeyLabel = formatForDisplay("Mod+K");

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
          onFocus={() => {
            if (canSearch && results.length > 0) {
              setOpen(true);
            }
          }}
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

      {showPanel ? (
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

                return (
                  <li key={result.id.raw} id={`${listId}-option-${index}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        active ? "bg-muted" : "hover:bg-muted/70",
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

                        <span className="mt-0.5 block text-xs text-muted-foreground">{code}</span>
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
