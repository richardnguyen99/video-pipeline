import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DEFAULT_SERIES_LOCALE,
  flattenSeriesFilterPages,
  mapSeriesDetailToNamedEntity,
  seriesDetailQueryOptions,
  seriesFilterInfiniteOptions,
} from "@/queries/series";
import type { NamedEntity } from "@/mocks/videos";
import { cn } from "@/libs/utils";

const SEARCH_DEBOUNCE_MS = 300;

interface SeriesSingleFilterProps {
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  container?: HTMLElement | null;
  triggerClassName?: (active?: boolean) => string;
}

export function SeriesSingleFilter({ value, onChange, container, triggerClassName }: SeriesSingleFilterProps) {
  const locale = DEFAULT_SERIES_LOCALE;
  const active = value != null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [draft, setDraft] = useState<number | undefined>(value);
  const [sessionName, setSessionName] = useState<string | undefined>();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isPending } = useInfiniteQuery(
    seriesFilterInfiniteOptions(debouncedQuery || undefined, locale),
  );

  const options = useMemo(() => flattenSeriesFilterPages(data?.pages), [data?.pages]);

  const optionNameById = useMemo(() => {
    const map: Partial<Record<number, string>> = {};

    for (const item of options) {
      map[item.id] = item.name;
    }

    return map;
  }, [options]);

  const needsDetail = value != null && optionNameById[value] === undefined && sessionName === undefined;

  const detailQuery = useQuery({
    ...seriesDetailQueryOptions(value ?? 0),
    enabled: needsDetail,
    staleTime: 5 * 60_000,
  });

  const detailName = detailQuery.data != null ? mapSeriesDetailToNamedEntity(detailQuery.data, locale).name : undefined;

  function resolveName(id: number): string {
    return optionNameById[id] ?? sessionName ?? detailName ?? `#${id}`;
  }

  const draftItem: NamedEntity | undefined =
    draft != null
      ? {
          id: draft,
          name: resolveName(draft),
        }
      : undefined;

  const available = options.filter((item) => item.id !== draft);

  const triggerLabel = value != null ? resolveName(value) : "Series";

  function selectionChanged(next: number | undefined): boolean {
    return next !== value;
  }

  function commitAndClose() {
    if (selectionChanged(draft)) {
      onChange(draft);
    }

    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
      setOpen(true);

      return;
    }

    commitAndClose();
  }

  function stopInputMenuKeys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      return;
    }

    e.stopPropagation();
  }

  function rememberName(item: NamedEntity) {
    setSessionName(item.name);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        className={
          triggerClassName
            ? triggerClassName(active)
            : cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm",
                active
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground",
              )
        }
      >
        <span className="max-w-36 truncate">{triggerLabel}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={4}
        container={container}
        className="z-100 min-w-64 w-(--anchor-width) max-sm:min-w-0 p-0"
      >
        <div className="flex flex-col gap-2 border-b border-border p-2">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-0 py-0">Series</DropdownMenuLabel>
          </DropdownMenuGroup>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={stopInputMenuKeys}
            onKeyUp={stopInputMenuKeys}
            placeholder="Search series…"
            className="h-8"
            aria-label="Search series"
          />
        </div>

        <ScrollArea key={`${debouncedQuery}-${options.length}`}>
          <div className="max-h-[min(50vh,20rem)] p-1">
            {isPending ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
            ) : available.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {options.length === 0 ? "No matches" : "No more options"}
              </p>
            ) : (
              available.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  closeOnClick={false}
                  onClick={() => {
                    rememberName(item);
                    setDraft(item.id);
                  }}
                >
                  {item.name}
                </DropdownMenuItem>
              ))
            )}

            {hasNextPage ? (
              <div className="p-1 pt-0">
                <Button
                  className="mt-1 w-full cursor-pointer"
                  variant="secondary"
                  size="sm"
                  disabled={isFetchingNextPage || isFetching}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void fetchNextPage();
                  }}
                >
                  {isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <DropdownMenuSeparator />

        <div className="flex min-h-8 flex-wrap gap-1.5 p-2">
          {draftItem == null ? (
            <p className="text-xs text-muted-foreground">No selection</p>
          ) : (
            <Badge variant="secondary" className="gap-1 pr-1">
              <span className="max-w-36 truncate">{draftItem.name}</span>
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer rounded-full p-0.5"
                aria-label={`Remove ${draftItem.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(undefined);
                }}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-2">
          <Button
            type="button"
            variant="destructive"
            className="flex-1 cursor-pointer"
            onClick={() => setDraft(undefined)}
            disabled={draft == null}
          >
            Clear
          </Button>
          <Button
            type="button"
            className="flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={commitAndClose}
            disabled={draft == null && value == null}
          >
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
