import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
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
  DEFAULT_GENRE_LOCALE,
  flattenGenreFilterPages,
  genreDetailQueryOptions,
  genreFilterInfiniteOptions,
  mapGenreDetailToNamedEntity,
} from "@/queries/genres";
import type { NamedEntity } from "@/mocks/videos";
import { cn } from "@/libs/utils";

const SEARCH_DEBOUNCE_MS = 300;

type NameMap = Partial<Record<number, string>>;

interface GenreMultiFilterProps {
  selected: number[];
  onChange: (ids: number[]) => void;
  container?: HTMLElement | null;
  triggerClassName?: (active?: boolean) => string;
}

export function GenreMultiFilter({ selected, onChange, container, triggerClassName }: GenreMultiFilterProps) {
  const locale = DEFAULT_GENRE_LOCALE;
  const active = selected.length > 0;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [draft, setDraft] = useState<number[]>(selected);
  const [sessionNames, setSessionNames] = useState<NameMap>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isPending } = useInfiniteQuery(
    genreFilterInfiniteOptions(debouncedQuery || undefined, locale),
  );

  const options = useMemo(() => flattenGenreFilterPages(data?.pages), [data?.pages]);

  const optionNameById = useMemo(() => {
    const map: NameMap = {};

    for (const item of options) {
      map[item.id] = item.name;
    }

    return map;
  }, [options]);

  const idsNeedingDetail = useMemo(() => {
    const needed = new Set([...selected, ...draft]);

    return [...needed].filter((id) => sessionNames[id] === undefined && optionNameById[id] === undefined);
  }, [selected, draft, sessionNames, optionNameById]);

  const detailQueries = useQueries({
    queries: idsNeedingDetail.map((genreId) => ({
      ...genreDetailQueryOptions(genreId),
      staleTime: 5 * 60_000,
    })),
  });

  const detailNameById: NameMap = {};

  for (const result of detailQueries) {
    if (result.data == null) {
      continue;
    }

    const entity = mapGenreDetailToNamedEntity(result.data, locale);
    detailNameById[entity.id] = entity.name;
  }

  const nameById: NameMap = {
    ...detailNameById,
    ...optionNameById,
    ...sessionNames,
  };

  function resolveName(id: number): string {
    return nameById[id] ?? `#${id}`;
  }

  const draftSet = new Set(draft);
  const draftItems: NamedEntity[] = draft.map((id) => ({
    id,
    name: resolveName(id),
  }));
  const available = options.filter((item) => !draftSet.has(item.id));

  function selectionChanged(next: number[]): boolean {
    if (next.length !== selected.length) {
      return true;
    }

    const prev = new Set(selected);

    return next.some((id) => !prev.has(id));
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
      setDraft(selected);
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
    setSessionNames((prev) => (prev[item.id] === item.name ? prev : { ...prev, [item.id]: item.name }));
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
        <span className="truncate">
          Genre
          {active ? ` (${selected.length})` : ""}
        </span>
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
            <DropdownMenuLabel className="px-0 py-0">Genre (OR)</DropdownMenuLabel>
          </DropdownMenuGroup>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={stopInputMenuKeys}
            onKeyUp={stopInputMenuKeys}
            placeholder="Search genre…"
            className="h-8"
            aria-label="Search genre"
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
                    setDraft((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
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

        <ScrollArea key={draftItems.map((item) => `${item.id}:${item.name}`).join(",")}>
          <div className="flex min-h-8 max-h-[min(20vh,12rem)] flex-wrap gap-1.5 p-2">
            {draftItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No selections</p>
            ) : (
              draftItems.map((item) => (
                <Badge key={item.id} variant="secondary" className="gap-1 pr-1">
                  <span className="max-w-28 truncate">{item.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="cursor-pointer rounded-full p-0.5"
                    aria-label={`Remove ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraft((prev) => prev.filter((id) => id !== item.id));
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 border-t border-border p-2">
          <Button
            type="button"
            variant="destructive"
            className="flex-1 cursor-pointer"
            onClick={() => setDraft([])}
            disabled={draft.length === 0}
          >
            Clear
          </Button>
          <Button
            type="button"
            className="flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={commitAndClose}
            disabled={draft.length === 0 && selected.length === 0}
          >
            Apply
            {draft.length > 0 ? ` (${draft.length})` : ""}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
