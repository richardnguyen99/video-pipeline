import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, Check, ChevronDown, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { GenreMultiFilter } from "@/components/video/genre-multi-filter";
import type { ActressFilters, ActressSort } from "@/libs/actresses";
import {
  ACTRESS_SORT_OPTIONS,
  DEFAULT_ACTRESS_FILTERS,
  buildActressesSearch,
  getAvailableActressLabels,
  getAvailableActressMakers,
  getAvailableCupSizes,
} from "@/libs/actresses";
import type { NamedEntity } from "@/mocks/videos";
import { cn } from "@/libs/utils";

interface ActressesToolbarProps {
  sort: ActressSort;
  filters: ActressFilters;
}

function filterTriggerClass(active?: boolean) {
  return cn(
    "inline-flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium sm:h-8 sm:w-auto sm:justify-center",
    "hover:bg-muted",
    active && "border-primary/50 text-primary",
  );
}

function parseOptionalInt(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function sortLabel(sort: ActressSort): string {
  const opt = ACTRESS_SORT_OPTIONS.find((o) => o.value === sort);
  if (!opt) return "Sort";
  return opt.group ? `${opt.group}: ${opt.label}` : opt.label;
}

function EntityFilterDropdown({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: NamedEntity[];
  selected: number[];
  onToggle: (id: number, checked: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={filterTriggerClass(selected.length > 0)}>
        <span className="truncate">
          {label}
          {selected.length > 0 ? ` (${selected.length})` : ""}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 w-(--anchor-width) max-sm:min-w-0 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 pt-2">{label} (OR)</DropdownMenuLabel>
          <ScrollArea className="h-auto max-h-125">
            <div className="p-1">
              {items.map((item) => (
                <DropdownMenuCheckboxItem
                  key={item.id}
                  checked={selected.includes(item.id)}
                  onCheckedChange={(checked) => onToggle(item.id, Boolean(checked))}
                >
                  {item.name}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </ScrollArea>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ActressesToolbar({ sort, filters }: ActressesToolbarProps) {
  const navigate = useNavigate();
  const labels = getAvailableActressLabels();
  const makers = getAvailableActressMakers();
  const cups = getAvailableCupSizes();

  const nonMeasurementCount = filters.labels.length + filters.genres.length + filters.makers.length;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    Boolean(
      filters.cups.length ||
      filters.bustMin != null ||
      filters.bustMax != null ||
      filters.waistMin != null ||
      filters.waistMax != null ||
      filters.hipMin != null ||
      filters.hipMax != null ||
      filters.heightMin != null ||
      filters.heightMax != null ||
      filters.ageMin != null ||
      filters.ageMax != null,
    ),
  );

  function updateSearch(next: { sort?: ActressSort; filters?: ActressFilters; page?: number }) {
    void navigate({
      to: "/actresses",
      search: buildActressesSearch({
        page: next.page ?? 1,
        sort: next.sort ?? sort,
        filters: next.filters ?? filters,
      }),
    });
  }

  function toggleIdFilter(key: "labels" | "genres" | "makers", id: number, checked: boolean) {
    const current = filters[key];
    const nextValues = checked ? [...current, id] : current.filter((v) => v !== id);
    updateSearch({
      filters: { ...filters, [key]: nextValues },
      page: 1,
    });
  }

  function toggleCup(value: string, checked: boolean) {
    const nextValues = checked ? [...filters.cups, value] : filters.cups.filter((v) => v !== value);
    updateSearch({
      filters: { ...filters, cups: nextValues },
      page: 1,
    });
  }

  const trending = ACTRESS_SORT_OPTIONS.filter((o) => o.group === "Trending");
  const otherSorts = ACTRESS_SORT_OPTIONS.filter((o) => !o.group);

  const hasActiveFilters =
    nonMeasurementCount > 0 ||
    filters.cups.length > 0 ||
    filters.bustMin != null ||
    filters.bustMax != null ||
    filters.waistMin != null ||
    filters.waistMax != null ||
    filters.hipMin != null ||
    filters.hipMax != null ||
    filters.heightMin != null ||
    filters.heightMax != null ||
    filters.ageMin != null ||
    filters.ageMax != null;

  const entityFilters = (
    <>
      <EntityFilterDropdown
        label="Label"
        items={labels}
        selected={filters.labels}
        onToggle={(id, checked) => toggleIdFilter("labels", id, checked)}
      />
      <GenreMultiFilter
        selected={filters.genres}
        onChange={(genres) => updateSearch({ filters: { ...filters, genres }, page: 1 })}
        triggerClassName={filterTriggerClass}
      />
      <EntityFilterDropdown
        label="Maker"
        items={makers}
        selected={filters.makers}
        onToggle={(id, checked) => toggleIdFilter("makers", id, checked)}
      />
    </>
  );

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
                  onClick={() => updateSearch({ sort: opt.value, page: 1 })}
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
                  onClick={() => updateSearch({ sort: opt.value, page: 1 })}
                  className="flex items-center justify-between gap-2"
                >
                  {opt.label}
                  {sort === opt.value ? <Check className="size-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-full space-y-2 sm:hidden">
          <button
            type="button"
            className={cn(filterTriggerClass(filtersOpen || nonMeasurementCount > 0))}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ListFilter className="size-3.5 shrink-0" />
              <span className="truncate">
                Filters
                {nonMeasurementCount > 0 ? ` (${nonMeasurementCount})` : ""}
              </span>
            </span>
            <ChevronDown
              className={cn("size-3.5 shrink-0 opacity-60 transition-transform", filtersOpen && "rotate-180")}
            />
          </button>
          {filtersOpen ? <div className="grid grid-cols-1 gap-2 pt-1">{entityFilters}</div> : null}
        </div>

        <div className="hidden sm:contents">{entityFilters}</div>

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(filterTriggerClass(moreOpen), moreOpen && "bg-muted")}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ListFilter className="size-3.5 shrink-0" />
            <span className="truncate">More filters</span>
          </span>
          <ChevronDown className={cn("size-3.5 shrink-0 opacity-60 transition-transform", moreOpen && "rotate-180")} />
        </button>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => updateSearch({ filters: { ...DEFAULT_ACTRESS_FILTERS }, page: 1 })}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleContent>
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card/40 p-3 xs:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-medium text-muted-foreground">Cup size</p>
              <div className="flex flex-wrap gap-1.5">
                {cups.map((cup) => {
                  const active = filters.cups.includes(cup);
                  return (
                    <button
                      key={cup}
                      type="button"
                      onClick={() => toggleCup(cup, !active)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {cup}
                    </button>
                  );
                })}
              </div>
            </div>

            {(
              [
                ["Bust", "bustMin", "bustMax"],
                ["Waist", "waistMin", "waistMax"],
                ["Hip", "hipMin", "hipMax"],
                ["Height", "heightMin", "heightMax"],
              ] as const
            ).map(([label, minKey, maxKey]) => (
              <div key={label} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Min"
                    className="h-8 text-xs placeholder:text-xs"
                    defaultValue={filters[minKey] ?? ""}
                    onBlur={(e) =>
                      updateSearch({
                        filters: {
                          ...filters,
                          [minKey]: parseOptionalInt(e.target.value),
                        },
                        page: 1,
                      })
                    }
                  />
                  <span className="hidden text-xs text-muted-foreground sm:inline">–</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Max"
                    className="h-8 text-xs placeholder:text-xs"
                    defaultValue={filters[maxKey] ?? ""}
                    onBlur={(e) =>
                      updateSearch({
                        filters: {
                          ...filters,
                          [maxKey]: parseOptionalInt(e.target.value),
                        },
                        page: 1,
                      })
                    }
                  />
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Age range [18, 99)</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={98}
                  placeholder="18"
                  className="h-8 text-xs placeholder:text-xs"
                  defaultValue={filters.ageMin ?? ""}
                  onBlur={(e) => {
                    const n = parseOptionalInt(e.target.value);
                    updateSearch({
                      filters: {
                        ...filters,
                        ageMin: n == null ? undefined : Math.max(18, n),
                      },
                      page: 1,
                    });
                  }}
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={19}
                  max={99}
                  placeholder="99"
                  className="h-8 text-xs placeholder:text-xs"
                  defaultValue={filters.ageMax ?? ""}
                  onBlur={(e) => {
                    const n = parseOptionalInt(e.target.value);
                    updateSearch({
                      filters: {
                        ...filters,
                        ageMax: n == null ? undefined : Math.min(99, n),
                      },
                      page: 1,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
