import { useId, useLayoutEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, ListFilter, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActressMultiFilter } from "@/components/video/actress-multi-filter";
import { GenreMultiFilter } from "@/components/video/genre-multi-filter";
import { CategoryVideoCard } from "@/components/video/category-video-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  FeaturesCountRange,
  VideoDiscoverFilters,
  VideoDiscoverSearchIssue,
  VideoSort,
} from "@/libs/discover-videos";
import {
  DEFAULT_VIDEO_FILTERS,
  DEFAULT_VIDEO_SORT,
  VIDEO_DISCOVER_PAGE_SIZE,
  VIDEO_SORT_OPTIONS,
  buildVideoDiscoverSearch,
  hasActiveDiscoverFilters,
} from "@/libs/discover-videos";
import { buttonVariants } from "@/libs/shadcn_variants";
import type { NamedEntity, Video } from "@/mocks/videos";
import { captureScrollPosition, cn, restoreScrollPosition } from "@/libs/utils";
import { Button } from "@/components/ui/button";

interface VideoBrowseProps {
  title?: string;
  description?: string;
  videos: Video[];
  total: number;
  page: number;
  totalPages: number;
  sort: VideoSort;
  filters: VideoDiscoverFilters;
  makerOptions: NamedEntity[];
  labelOptions: NamedEntity[];
  directorOptions: NamedEntity[];
  seriesOptions: NamedEntity[];
  searchIssues?: VideoDiscoverSearchIssue[];
  className?: string;
}

function sortLabel(sort: VideoSort): string {
  const opt = VIDEO_SORT_OPTIONS.find((o) => o.value === sort);
  if (!opt) return "Sort";
  return opt.group ? `${opt.group}: ${opt.label}` : opt.label;
}

function filterTriggerClass(active?: boolean) {
  return cn(
    "inline-flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium sm:h-8 sm:w-auto sm:justify-center",
    "hover:bg-muted",
    active && "border-primary/50 text-primary",
  );
}

function entityName(options: NamedEntity[], id: number | undefined): string | undefined {
  if (id == null) return undefined;
  return options.find((o) => o.id === id)?.name;
}

function featuresCntLabel(range: FeaturesCountRange | undefined): string {
  if (!range) return "Features";
  if (range.max == null) return `${range.min}+`;
  if (range.min === range.max) return String(range.min);
  return `${range.min}–${range.max}`;
}

function buildPageNumbers(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages]);

  for (let p = page - 2; p <= page + 2; p++) {
    if (p >= 1 && p <= totalPages) {
      pages.add(p);
    }
  }

  return [...pages].sort((a, b) => a - b);
}

export function VideoBrowse({
  title = "Videos",
  description,
  videos,
  total,
  page,
  totalPages,
  sort,
  filters,
  makerOptions,
  labelOptions,
  directorOptions,
  seriesOptions,
  searchIssues = [],
  className,
}: VideoBrowseProps) {
  const navigate = useNavigate();
  const [dismissedIssueKey, setDismissedIssueKey] = useState<string | null>(null);
  const [alertOpenForKey, setAlertOpenForKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [menuPortal, setMenuPortal] = useState<HTMLDivElement | null>(null);
  const [dialogBody, setDialogBody] = useState<HTMLDivElement | null>(null);
  const issueKey = searchIssues.map((i) => `${i.path}:${i.message}`).join("|");
  const alertDismissed = dismissedIssueKey === issueKey && issueKey !== "";
  const alertOpen = alertOpenForKey === issueKey;

  useLayoutEffect(() => {
    restoreScrollPosition();
  }, [videos, sort, filters, page]);

  function openFiltersDialog() {
    setDraftFilters(filters);
    setFiltersOpen(true);
  }

  const trending = VIDEO_SORT_OPTIONS.filter((o) => o.group === "Trending");
  const otherSorts = VIDEO_SORT_OPTIONS.filter((o) => !o.group);
  const filtersActive = hasActiveDiscoverFilters(filters);
  const activeFilterCount = [
    filters.actresses.length > 0,
    filters.genres.length > 0,
    filters.maker != null,
    filters.label != null,
    filters.director != null,
    filters.series != null,
    filters.features_cnt != null,
  ].filter(Boolean).length;

  function updateSearch(next: { sort?: VideoSort; filters?: VideoDiscoverFilters; page?: number }) {
    const nextSort = next.sort ?? sort;
    const nextFilters = next.filters ?? filters;
    const filtersChanged = next.filters != null || (next.sort != null && next.sort !== sort);
    const nextPage = filtersChanged ? 1 : (next.page ?? page);

    void navigate({
      to: "/videos",
      search: buildVideoDiscoverSearch({
        sort: nextSort,
        filters: nextFilters,
        page: nextPage,
      }),
      replace: true,
      resetScroll: false,
    });
  }

  function setSingle(key: "maker" | "label" | "director" | "series", value: number | undefined) {
    updateSearch({
      filters: {
        ...filters,
        [key]: value,
      },
    });
  }

  function setFeaturesCnt(range: FeaturesCountRange | undefined) {
    updateSearch({
      filters: {
        ...filters,
        features_cnt: range,
      },
    });
  }

  return (
    <div className={cn("mx-auto w-full px-6 py-10 sm:px-10 lg:px-16", className)}>
      <header className="mb-8">
        <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          {description ?? "Discover titles across the catalog."}
          {` ${total} ${total === 1 ? "video" : "videos"}.`}
        </p>
      </header>

      {searchIssues.length > 0 && !alertDismissed ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle />
          <div className="flex items-start justify-between gap-3 col-start-2">
            <div className="min-w-0 flex-1">
              <AlertTitle>Some search parameters were ignored</AlertTitle>
              <AlertDescription>
                Invalid query values were skipped so results still load. Expand for details.
              </AlertDescription>
              <Collapsible
                open={alertOpen}
                onOpenChange={(open) => setAlertOpenForKey(open ? issueKey : null)}
                className="mt-2"
              >
                <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs font-medium text-current/80 hover:text-current">
                  <ChevronRight className={cn("size-3.5 transition-transform", alertOpen && "rotate-90")} />
                  {alertOpen ? "Hide details" : "Show details"}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {searchIssues.map((issue, index) => (
                      <li key={`${issue.path}-${index}`}>
                        <span className="font-medium">{issue.path}</span>
                        {": "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </div>
            <button
              type="button"
              aria-label="Dismiss alert"
              className="shrink-0 rounded-md p-1 text-current/70 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
              onClick={() => setDismissedIssueKey(issueKey)}
            >
              <X className="size-4" />
            </button>
          </div>
        </Alert>
      ) : null}

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DropdownMenu>
          <DropdownMenuTrigger className={filterTriggerClass()}>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ArrowUpDown className="size-3.5 shrink-0" />
              <span className="truncate">{sortLabel(sort)}</span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48 w-(--anchor-width) max-sm:min-w-0">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Trending</DropdownMenuLabel>
              {trending.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => updateSearch({ sort: opt.value })}
                  className="relative pl-8"
                >
                  <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center">
                    {sort === opt.value ? <Check className="size-4" /> : null}
                  </span>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {otherSorts.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => updateSearch({ sort: opt.value })}
                  className="relative pl-8"
                >
                  <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center">
                    {sort === opt.value ? <Check className="size-4" /> : null}
                  </span>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex w-full flex-col gap-2 sm:hidden">
          <button
            type="button"
            className={cn(filterTriggerClass(filtersActive || filtersOpen), "w-full")}
            onClick={openFiltersDialog}
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ListFilter className="size-3.5 shrink-0" />
              <span className="truncate">
                Filters
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </button>

          {filtersActive || sort !== DEFAULT_VIDEO_SORT ? (
            <button
              type="button"
              className={cn(
                filterTriggerClass(true),
                "w-full border-destructive/40 text-destructive hover:bg-destructive/10",
              )}
              onClick={() =>
                updateSearch({
                  sort: DEFAULT_VIDEO_SORT,
                  filters: { ...DEFAULT_VIDEO_FILTERS },
                })
              }
            >
              Clear
            </button>
          ) : null}
        </div>

        <Dialog
          open={filtersOpen}
          onOpenChange={(open) => {
            if (!open) {
              updateSearch({ filters: draftFilters });
            }
            setFiltersOpen(open);
          }}
        >
          <DialogContent className="max-w-md gap-0 overflow-visible sm:hidden">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
              <DialogClose />
            </DialogHeader>
            <div className="relative">
              <div ref={setDialogBody} className="absolute top-0 left-0 z-100 h-0 w-0 overflow-visible" aria-hidden />
              <div className="flex max-h-[min(70vh,28rem)] flex-col gap-2 overflow-y-auto px-5 py-4">
                <ActressMultiFilter
                  selected={draftFilters.actresses}
                  onChange={(actresses) => setDraftFilters((prev) => ({ ...prev, actresses }))}
                  container={dialogBody}
                  triggerClassName={filterTriggerClass}
                />
                <GenreMultiFilter
                  selected={draftFilters.genres}
                  onChange={(genres) => setDraftFilters((prev) => ({ ...prev, genres }))}
                  container={dialogBody}
                  triggerClassName={filterTriggerClass}
                />
                <SingleEntityFilter
                  label="Maker"
                  value={draftFilters.maker}
                  display={entityName(makerOptions, draftFilters.maker)}
                  options={makerOptions}
                  onChange={(id) => setDraftFilters((prev) => ({ ...prev, maker: id }))}
                  container={dialogBody}
                />
                <SingleEntityFilter
                  label="Label"
                  value={draftFilters.label}
                  display={entityName(labelOptions, draftFilters.label)}
                  options={labelOptions}
                  onChange={(id) => setDraftFilters((prev) => ({ ...prev, label: id }))}
                  container={dialogBody}
                />
                <SingleEntityFilter
                  label="Director"
                  value={draftFilters.director}
                  display={entityName(directorOptions, draftFilters.director)}
                  options={directorOptions}
                  onChange={(id) => setDraftFilters((prev) => ({ ...prev, director: id }))}
                  container={dialogBody}
                />
                <SingleEntityFilter
                  label="Series"
                  value={draftFilters.series}
                  display={entityName(seriesOptions, draftFilters.series)}
                  options={seriesOptions}
                  onChange={(id) => setDraftFilters((prev) => ({ ...prev, series: id }))}
                  container={dialogBody}
                />
                <FeaturesCountFilter
                  value={draftFilters.features_cnt}
                  onChange={(range) => setDraftFilters((prev) => ({ ...prev, features_cnt: range }))}
                  container={dialogBody}
                />
              </div>
            </div>
            <DialogFooter className="border-t border-border">
              {hasActiveDiscoverFilters(draftFilters) ? (
                <button
                  type="button"
                  className={cn(
                    filterTriggerClass(true),
                    "w-full border-destructive/40 text-destructive hover:bg-destructive/10",
                  )}
                  onClick={() => setDraftFilters({ ...DEFAULT_VIDEO_FILTERS })}
                >
                  Clear filters
                </button>
              ) : null}
              <button
                type="button"
                className={cn(filterTriggerClass(), "w-full bg-primary text-primary-foreground hover:bg-primary/90")}
                onClick={() => {
                  updateSearch({ filters: draftFilters });
                  setFiltersOpen(false);
                }}
              >
                Done
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="hidden sm:contents">
          <ActressMultiFilter
            selected={filters.actresses}
            onChange={(actresses) => updateSearch({ filters: { ...filters, actresses } })}
            container={menuPortal}
            triggerClassName={filterTriggerClass}
          />
          <GenreMultiFilter
            selected={filters.genres}
            onChange={(genres) => updateSearch({ filters: { ...filters, genres } })}
            container={menuPortal}
            triggerClassName={filterTriggerClass}
          />
          <SingleEntityFilter
            label="Maker"
            value={filters.maker}
            display={entityName(makerOptions, filters.maker)}
            options={makerOptions}
            onChange={(id) => setSingle("maker", id)}
            container={menuPortal}
          />
          <SingleEntityFilter
            label="Label"
            value={filters.label}
            display={entityName(labelOptions, filters.label)}
            options={labelOptions}
            onChange={(id) => setSingle("label", id)}
            container={menuPortal}
          />
          <SingleEntityFilter
            label="Director"
            value={filters.director}
            display={entityName(directorOptions, filters.director)}
            options={directorOptions}
            onChange={(id) => setSingle("director", id)}
            container={menuPortal}
          />
          <SingleEntityFilter
            label="Series"
            value={filters.series}
            display={entityName(seriesOptions, filters.series)}
            options={seriesOptions}
            onChange={(id) => setSingle("series", id)}
            container={menuPortal}
          />
          <FeaturesCountFilter value={filters.features_cnt} onChange={setFeaturesCnt} container={menuPortal} />
          {filtersActive || sort !== DEFAULT_VIDEO_SORT ? (
            <button
              type="button"
              className={cn(filterTriggerClass(true), "border-destructive/40 text-destructive hover:bg-destructive/10")}
              onClick={() =>
                updateSearch({
                  sort: DEFAULT_VIDEO_SORT,
                  filters: { ...DEFAULT_VIDEO_FILTERS },
                })
              }
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {total === 0 ? <p className="text-sm text-muted-foreground">No videos match these filters.</p> : null}

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: VIDEO_DISCOVER_PAGE_SIZE }, (_, index) => {
          const video: Video | undefined = index < videos.length ? videos[index] : undefined;

          return (
            <li key={video?.video_id ?? `empty-${index}`} className="min-w-0">
              {video ? (
                <CategoryVideoCard video={video} variant="grid" />
              ) : (
                <div className="aspect-video w-full rounded-2xl border border-transparent bg-transparent" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>

      {totalPages > 1 ? (
        <Pagination className="mt-10">
          <PaginationContent>
            <PaginationItem>
              {page > 1 ? (
                <Link
                  to="/videos"
                  search={buildVideoDiscoverSearch({
                    sort,
                    filters,
                    page: page - 1,
                  })}
                  resetScroll={false}
                  onClick={() => captureScrollPosition()}
                  aria-label="Go to previous page"
                  className={cn(buttonVariants({ variant: "outline", size: "default" }), "gap-1 px-2.5 sm:pr-2.5")}
                >
                  <ChevronLeft className="size-4" />
                  <span className="hidden sm:block">Previous</span>
                </Link>
              ) : (
                <span
                  aria-disabled
                  aria-label="Go to previous page"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "pointer-events-none gap-1 px-2.5 opacity-50 sm:pr-2.5",
                  )}
                >
                  <ChevronLeft className="size-4" />
                  <span className="hidden sm:block">Previous</span>
                </span>
              )}
            </PaginationItem>

            {buildPageNumbers(page, totalPages).map((p, i, pageNumbers) => {
              const prev = i > 0 ? pageNumbers.at(i - 1) : undefined;
              const showEllipsis = prev !== undefined && p - prev > 1;

              return (
                <span key={p} className="contents">
                  {showEllipsis ? (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : null}
                  <PaginationItem>
                    <Link
                      to="/videos"
                      search={buildVideoDiscoverSearch({
                        sort,
                        filters,
                        page: p,
                      })}
                      resetScroll={false}
                      onClick={() => captureScrollPosition()}
                      aria-label={`Go to page ${p}`}
                      aria-current={p === page ? "page" : undefined}
                      className={cn(
                        buttonVariants({
                          variant: p === page ? "default" : "outline",
                          size: "icon",
                        }),
                        "h-9 min-w-9 w-auto px-2.5",
                      )}
                    >
                      {p}
                    </Link>
                  </PaginationItem>
                </span>
              );
            })}

            <PaginationItem>
              {page < totalPages ? (
                <Link
                  to="/videos"
                  search={buildVideoDiscoverSearch({
                    sort,
                    filters,
                    page: page + 1,
                  })}
                  resetScroll={false}
                  onClick={() => captureScrollPosition()}
                  aria-label="Go to next page"
                  className={cn(buttonVariants({ variant: "outline", size: "default" }), "gap-1 px-2.5 sm:pl-2.5")}
                >
                  <span className="hidden sm:block">Next</span>
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <span
                  aria-disabled
                  aria-label="Go to next page"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "pointer-events-none gap-1 px-2.5 opacity-50 sm:pl-2.5",
                  )}
                >
                  <span className="hidden sm:block">Next</span>
                  <ChevronRight className="size-4" />
                </span>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}

      <div ref={setMenuPortal} className="relative z-100" />
    </div>
  );
}

function MultiEntityFilter({
  label,
  selected,
  options,
  onChange,
  container,
}: {
  label: string;
  selected: number[];
  options: NamedEntity[];
  onChange: (ids: number[]) => void;
  container?: HTMLElement | null;
}) {
  const active = selected.length > 0;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<number[]>(selected);

  const draftSet = new Set(draft);
  const draftItems = options.filter((item) => draftSet.has(item.id));
  const available = options.filter((item) => !draftSet.has(item.id));
  const normalized = query.trim().toLowerCase();
  const filtered = normalized ? available.filter((item) => item.name.toLowerCase().includes(normalized)) : available;

  function commitAndClose() {
    onChange(draft);
    setQuery("");
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(selected);
      setOpen(true);
    } else {
      commitAndClose();
    }
  }

  function stopInputMenuKeys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      return;
    }

    e.stopPropagation();
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className={filterTriggerClass(active)}>
        <span className="truncate">
          {label}
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
            <DropdownMenuLabel className="px-0 py-0">{label} (OR)</DropdownMenuLabel>
          </DropdownMenuGroup>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={stopInputMenuKeys}
            onKeyUp={stopInputMenuKeys}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-8"
            aria-label={`Search ${label}`}
          />
        </div>

        {/** This key ensures the ScrollArea resets when the filtered list or
         * query changes, especially when the list is changed during a query
         * search.
         */}
        <ScrollArea key={filtered.length + query} className="">
          <div className="p-1 max-h-[min(50vh,20rem)]">
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {available.length === 0 ? "No more options" : "No matches"}
              </p>
            ) : (
              filtered.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  closeOnClick={false}
                  onClick={() => setDraft((prev) => [...prev, item.id])}
                >
                  {item.name}
                </DropdownMenuItem>
              ))
            )}
          </div>
        </ScrollArea>
        <DropdownMenuSeparator />

        <ScrollArea key={draftItems.length} className="">
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
                    className="rounded-full p-0.5 cursor-pointer"
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
            className={cn("flex-1 cursor-pointer")}
            onClick={() => setDraft([])}
            disabled={draft.length === 0}
          >
            Clear
          </Button>
          <Button
            type="button"
            className={cn("flex-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer")}
            onClick={commitAndClose}
            disabled={draft.length === 0 && selected.length === 0}
          >
            Apply
            {draft.length > 0 && ` (${draft.length})`}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SingleEntityFilter({
  label,
  value,
  display,
  options,
  onChange,
  container,
}: {
  label: string;
  value: number | undefined;
  display: string | undefined;
  options: NamedEntity[];
  onChange: (id: number | undefined) => void;
  container?: HTMLElement | null;
}) {
  const active = value != null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<number | undefined>(value);

  const draftItem = draft != null ? options.find((item) => item.id === draft) : undefined;
  const available = options.filter((item) => item.id !== draft);
  const normalized = query.trim().toLowerCase();
  const filtered = normalized ? available.filter((item) => item.name.toLowerCase().includes(normalized)) : available;

  function commitAndClose() {
    onChange(draft);
    setQuery("");
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
      setOpen(true);
    } else {
      commitAndClose();
    }
  }

  function stopInputMenuKeys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      return;
    }

    e.stopPropagation();
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className={filterTriggerClass(active)}>
        <span className="max-w-36 truncate">{active && display ? display : label}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        container={container}
        className="z-100 min-w-64 w-(--anchor-width) max-sm:min-w-0 p-0"
      >
        <div className="flex flex-col gap-2 border-b border-border p-2">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-0 py-0">{label}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={stopInputMenuKeys}
            onKeyUp={stopInputMenuKeys}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-8"
            aria-label={`Search ${label}`}
          />
        </div>
        <ScrollArea key={filtered.length + query} className="max-h-[min(50vh,20rem)]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {available.length === 0 ? "No more options" : "No matches"}
              </p>
            ) : (
              filtered.map((item) => (
                <DropdownMenuItem key={item.id} closeOnClick={false} onClick={() => setDraft(item.id)}>
                  {item.name}
                </DropdownMenuItem>
              ))
            )}
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
                className="rounded-full p-0.5 cursor-pointer"
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
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
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

function FeaturesCountFilter({
  value,
  onChange,
  container,
}: {
  value: FeaturesCountRange | undefined;
  onChange: (range: FeaturesCountRange | undefined) => void;
  container?: HTMLElement | null;
}) {
  const active = value != null;
  const minId = useId();
  const maxId = useId();
  const openId = useId();

  const [open, setOpen] = useState(false);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [openEnded, setOpenEnded] = useState(false);

  function syncFieldsFromValue() {
    setMinText(value != null ? String(value.min) : "");
    setMaxText(value == null || value.max == null ? "" : String(value.max));
    setOpenEnded(value != null && value.max == null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      syncFieldsFromValue();
    }

    setOpen(nextOpen);
  }

  function commit(nextMin: string, nextMax: string, openMax: boolean) {
    const min = nextMin.trim() === "" ? NaN : Number(nextMin);
    if (!Number.isFinite(min) || min < 0) {
      onChange(undefined);
      return;
    }
    const floorMin = Math.floor(min);
    if (openMax) {
      onChange({ min: floorMin });
      return;
    }
    const max = nextMax.trim() === "" ? floorMin : Number(nextMax);
    if (!Number.isFinite(max)) {
      onChange({ min: floorMin, max: floorMin });
      return;
    }
    const floorMax = Math.floor(max);
    onChange({
      min: Math.min(floorMin, floorMax),
      max: Math.max(floorMin, floorMax),
    });
  }

  function stopInputMenuKeys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      return;
    }

    e.stopPropagation();
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className={filterTriggerClass(active)}>
        <span className="truncate">{featuresCntLabel(value)}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        container={container}
        className="z-100 w-(--anchor-width) min-w-0 max-sm:min-w-0 p-3 sm:min-w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-0 pt-0">Featured actresses</DropdownMenuLabel>
        </DropdownMenuGroup>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={minId} className="text-xs text-muted-foreground">
                Min
              </Label>
              <Input
                id={minId}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                className="h-8"
                value={minText}
                onChange={(e) => setMinText(e.target.value)}
                onKeyDown={stopInputMenuKeys}
                onKeyUp={stopInputMenuKeys}
                onBlur={() => commit(minText, maxText, openEnded)}
              />
            </div>
            <span className="mt-5 text-xs text-muted-foreground">to</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={maxId} className="text-xs text-muted-foreground">
                Max
              </Label>
              <Input
                id={maxId}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder={openEnded ? "∞" : "0"}
                className="h-8"
                disabled={openEnded}
                value={maxText}
                onChange={(e) => setMaxText(e.target.value)}
                onKeyDown={stopInputMenuKeys}
                onKeyUp={stopInputMenuKeys}
                onBlur={() => {
                  if (!openEnded) commit(minText, maxText, false);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id={openId}
              type="checkbox"
              className="peer size-3.5 shrink-0 rounded border border-border accent-primary"
              checked={openEnded}
              onChange={(e) => {
                const next = e.target.checked;
                setOpenEnded(next);
                commit(minText || "0", maxText, next);
              }}
              onKeyDown={stopInputMenuKeys}
            />
            <Label htmlFor={openId} className="font-normal text-muted-foreground">
              Or more (open max)
            </Label>
          </div>
          {active ? (
            <button
              type="button"
              className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setMinText("");
                setMaxText("");
                setOpenEnded(false);
                onChange(undefined);
              }}
            >
              Clear range
            </button>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
