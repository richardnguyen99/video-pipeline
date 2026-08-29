import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowUpDown, Check, ChevronDown, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActressVideoFilters, ActressVideoSort } from "@/libs/actress-videos";
import {
  ACTRESS_VIDEO_SORT_OPTIONS,
  DEFAULT_ACTRESS_VIDEO_FILTERS,
  buildActressVideoSearch,
} from "@/libs/actress-videos";
import { GenreMultiFilter } from "@/components/video/genre-multi-filter";
import { getAvailableDiscoverLabels, getAvailableDiscoverMakers } from "@/libs/discover-videos";
import type { NamedEntity } from "@/mocks/videos";
import { captureScrollPosition, cn } from "@/libs/utils";

interface ActressVideosToolbarProps {
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
}

function filterTriggerClass(active?: boolean) {
  return cn(
    "inline-flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium sm:h-8 sm:w-auto sm:justify-center",
    "hover:bg-muted",
    active && "border-primary/50 text-primary",
  );
}

function sortLabel(sort: ActressVideoSort): string {
  return ACTRESS_VIDEO_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";
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
  if (items.length === 0) return null;

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
          <ScrollArea className="h-auto">
            <div className="p-1 max-h-75">
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

export function ActressVideosToolbar({ sort, filters }: ActressVideosToolbarProps) {
  const navigate = useNavigate();
  const { actressId } = useParams({ from: "/actresses/$actressId" });
  const labels = getAvailableDiscoverLabels();
  const makers = getAvailableDiscoverMakers();

  const [filtersOpen, setFiltersOpen] = useState(false);

  const nonMeasurementCount = filters.labels.length + filters.genres.length + filters.makers.length;

  const hasActiveFilters = nonMeasurementCount > 0;

  function updateSearch(next: { sort?: ActressVideoSort; filters?: ActressVideoFilters }) {
    captureScrollPosition();
    void navigate({
      to: "/actresses/$actressId",
      params: { actressId },
      search: buildActressVideoSearch({
        page: 1,
        sort: next.sort ?? sort,
        filters: next.filters ?? filters,
      }),
      replace: true,
      resetScroll: false,
    });
  }

  function toggleIdFilter(key: "labels" | "makers", id: number, checked: boolean) {
    const current = filters[key];
    const nextValues = checked ? [...current, id] : current.filter((v) => v !== id);
    updateSearch({
      filters: { ...filters, [key]: nextValues },
    });
  }

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
        onChange={(genres) => updateSearch({ filters: { ...filters, genres } })}
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
              {ACTRESS_VIDEO_SORT_OPTIONS.map((opt) => (
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

        <div className="w-full space-y-2 sm:hidden">
          <button
            type="button"
            className={cn(filterTriggerClass(filtersOpen || hasActiveFilters))}
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
          {filtersOpen ? <div className="grid grid-cols-1 gap-2">{entityFilters}</div> : null}
        </div>

        <div className="hidden sm:contents">{entityFilters}</div>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => updateSearch({ filters: { ...DEFAULT_ACTRESS_VIDEO_FILTERS } })}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
