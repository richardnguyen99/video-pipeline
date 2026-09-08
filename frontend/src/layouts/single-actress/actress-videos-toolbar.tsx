import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowUpDown, Check, ChevronDown, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActressVideoFilters, ActressVideoSort } from "@/libs/actress-videos";
import {
  ACTRESS_VIDEO_SORT_OPTIONS,
  DEFAULT_ACTRESS_VIDEO_FILTERS,
  buildActressVideoSearch,
} from "@/libs/actress-videos";
import { DirectorSingleFilter } from "@/components/video/director-single-filter";
import { GenreMultiFilter } from "@/components/video/genre-multi-filter";
import { LabelSingleFilter } from "@/components/video/label-single-filter";
import { MakerSingleFilter } from "@/components/video/maker-single-filter";
import { SeriesSingleFilter } from "@/components/video/series-single-filter";
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

export function ActressVideosToolbar({ sort, filters }: ActressVideosToolbarProps) {
  const navigate = useNavigate();
  const { actressId } = useParams({ from: "/actresses/$actressId" });

  const [filtersOpen, setFiltersOpen] = useState(false);

  const nonMeasurementCount =
    filters.labels.length +
    filters.genres.length +
    filters.makers.length +
    filters.directors.length +
    (filters.series != null ? 1 : 0);

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

  const entityFilters = (
    <>
      <LabelSingleFilter
        value={filters.labels[0]}
        onChange={(labelId) =>
          updateSearch({
            filters: {
              ...filters,
              labels: labelId != null ? [labelId] : [],
            },
          })
        }
        triggerClassName={filterTriggerClass}
      />

      <GenreMultiFilter
        selected={filters.genres}
        onChange={(genres) => updateSearch({ filters: { ...filters, genres } })}
        triggerClassName={filterTriggerClass}
      />

      <SeriesSingleFilter
        value={filters.series}
        onChange={(series) => updateSearch({ filters: { ...filters, series } })}
        triggerClassName={filterTriggerClass}
      />

      <MakerSingleFilter
        value={filters.makers[0]}
        onChange={(makerId) =>
          updateSearch({
            filters: {
              ...filters,
              makers: makerId != null ? [makerId] : [],
            },
          })
        }
        triggerClassName={filterTriggerClass}
      />

      <DirectorSingleFilter
        value={filters.directors[0]}
        onChange={(directorId) =>
          updateSearch({
            filters: {
              ...filters,
              directors: directorId != null ? [directorId] : [],
            },
          })
        }
        triggerClassName={filterTriggerClass}
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
