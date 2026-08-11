import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";

import { CategoryVideoCard } from "@/components/video/category-video-card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FeaturesCountRange, VideoDiscoverFilters, VideoSort } from "@/libs/discover-videos";
import {
  DEFAULT_VIDEO_FILTERS,
  DEFAULT_VIDEO_SORT,
  VIDEO_SORT_OPTIONS,
  buildVideoDiscoverSearch,
  hasActiveDiscoverFilters,
} from "@/libs/discover-videos";
import type { NamedEntity, Video } from "@/mocks/videos";
import { cn } from "@/libs/utils";

interface VideoBrowseProps {
  title?: string;
  description?: string;
  videos: Video[];
  total: number;
  sort: VideoSort;
  filters: VideoDiscoverFilters;
  actressOptions: NamedEntity[];
  genreOptions: NamedEntity[];
  makerOptions: NamedEntity[];
  labelOptions: NamedEntity[];
  directorOptions: NamedEntity[];
  seriesOptions: NamedEntity[];
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

export function VideoBrowse({
  title = "Videos",
  description,
  videos,
  total,
  sort,
  filters,
  actressOptions,
  genreOptions,
  makerOptions,
  labelOptions,
  directorOptions,
  seriesOptions,
  className,
}: VideoBrowseProps) {
  const navigate = useNavigate();

  const trending = VIDEO_SORT_OPTIONS.filter((o) => o.group === "Trending");
  const otherSorts = VIDEO_SORT_OPTIONS.filter((o) => !o.group);
  const filtersActive = hasActiveDiscoverFilters(filters);

  function updateSearch(next: { sort?: VideoSort; filters?: VideoDiscoverFilters }) {
    void navigate({
      to: "/videos",
      search: buildVideoDiscoverSearch({
        sort: next.sort ?? sort,
        filters: next.filters ?? filters,
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
                  className="flex items-center justify-between gap-2"
                >
                  {opt.label}
                  {sort === opt.value ? <Check className="size-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {otherSorts.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => updateSearch({ sort: opt.value })}
                  className="flex items-center justify-between gap-2"
                >
                  {opt.label}
                  {sort === opt.value ? <Check className="size-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <MultiEntityFilter
          label="Actress"
          selected={filters.actresses}
          options={actressOptions}
          onChange={(actresses) => updateSearch({ filters: { ...filters, actresses } })}
        />

        <MultiEntityFilter
          label="Genre"
          selected={filters.genres}
          options={genreOptions}
          onChange={(genres) => updateSearch({ filters: { ...filters, genres } })}
        />

        <SingleEntityFilter
          label="Maker"
          value={filters.maker}
          display={entityName(makerOptions, filters.maker)}
          options={makerOptions}
          onChange={(id) => setSingle("maker", id)}
        />

        <SingleEntityFilter
          label="Label"
          value={filters.label}
          display={entityName(labelOptions, filters.label)}
          options={labelOptions}
          onChange={(id) => setSingle("label", id)}
        />

        <SingleEntityFilter
          label="Director"
          value={filters.director}
          display={entityName(directorOptions, filters.director)}
          options={directorOptions}
          onChange={(id) => setSingle("director", id)}
        />

        <SingleEntityFilter
          label="Series"
          value={filters.series}
          display={entityName(seriesOptions, filters.series)}
          options={seriesOptions}
          onChange={(id) => setSingle("series", id)}
        />

        <FeaturesCountFilter value={filters.features_cnt} onChange={setFeaturesCnt} />

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

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No videos match these filters.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <li key={video.video_id} className="min-w-0">
              <CategoryVideoCard video={video} variant="grid" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MultiEntityFilter({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: number[];
  options: NamedEntity[];
  onChange: (ids: number[]) => void;
}) {
  const active = selected.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={filterTriggerClass(active)}>
        <span className="truncate">
          {label}
          {active ? ` (${selected.length})` : ""}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 w-(--anchor-width) max-sm:min-w-0 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 pt-2">{label} (OR)</DropdownMenuLabel>
          <ScrollArea className="h-auto ">
            <div className="p-1 max-h-125">
              {options.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No options</p>
              ) : (
                options.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.id}
                    checked={selected.includes(item.id)}
                    onCheckedChange={(checked) => {
                      onChange(checked ? [...selected, item.id] : selected.filter((id) => id !== item.id));
                    }}
                  >
                    {item.name}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </div>
          </ScrollArea>
        </DropdownMenuGroup>
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
}: {
  label: string;
  value: number | undefined;
  display: string | undefined;
  options: NamedEntity[];
  onChange: (id: number | undefined) => void;
}) {
  const active = value != null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={filterTriggerClass(active)}>
        <span className="max-w-36 truncate">{active && display ? display : label}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 w-(--anchor-width) max-sm:min-w-0 p-0">
        <ScrollArea className="h-auto ">
          <div className="p-1 max-h-125">
            <DropdownMenuItem onClick={() => onChange(undefined)} className="flex items-center justify-between gap-2">
              Any
              {value == null ? <Check className="size-4" /> : null}
            </DropdownMenuItem>
            {options.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => onChange(item.id)}
                className="flex items-center justify-between gap-2"
              >
                {item.name}
                {value === item.id ? <Check className="size-4" /> : null}
              </DropdownMenuItem>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FeaturesCountFilter({
  value,
  onChange,
}: {
  value: FeaturesCountRange | undefined;
  onChange: (range: FeaturesCountRange | undefined) => void;
}) {
  const active = value != null;
  const minId = useId();
  const maxId = useId();
  const openId = useId();

  const [open, setOpen] = useState(false);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [openEnded, setOpenEnded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinText(value != null ? String(value.min) : "");
    setMaxText(value == null || value.max == null ? "" : String(value.max));
    setOpenEnded(value != null && value.max == null);
  }, [open, value]);

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

  function stopMenuKeys(e: KeyboardEvent) {
    e.stopPropagation();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={filterTriggerClass(active)}>
        <span className="truncate">{featuresCntLabel(value)}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 p-3" onKeyDown={stopMenuKeys}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-0 pt-0">Featured actresses</DropdownMenuLabel>
        </DropdownMenuGroup>
        <div className="mt-2 flex flex-col gap-2" onKeyDown={stopMenuKeys} onKeyUp={stopMenuKeys}>
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
                onKeyDown={stopMenuKeys}
                onKeyUp={stopMenuKeys}
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
                onKeyDown={stopMenuKeys}
                onKeyUp={stopMenuKeys}
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
              onKeyDown={stopMenuKeys}
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
