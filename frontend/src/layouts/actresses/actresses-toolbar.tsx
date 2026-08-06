import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, ListFilter, ArrowUpDown } from "lucide-react";

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
import type { ActressFilters, ActressSort } from "@/libs/actresses";
import {
  ACTRESS_SORT_OPTIONS,
  DEFAULT_ACTRESS_FILTERS,
  buildActressesSearch,
  getAvailableActressGenres,
  getAvailableActressLabels,
  getAvailableCupSizes,
} from "@/libs/actresses";
import { cn } from "@/libs/utils";

interface ActressesToolbarProps {
  sort: ActressSort;
  filters: ActressFilters;
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

export function ActressesToolbar({ sort, filters }: ActressesToolbarProps) {
  const navigate = useNavigate();
  const labels = getAvailableActressLabels();
  const genres = getAvailableActressGenres();
  const cups = getAvailableCupSizes();
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

  function toggleListValue(key: "labels" | "genres" | "cups", value: string, checked: boolean) {
    const current = filters[key];
    const nextValues = checked ? [...current, value] : current.filter((v) => v !== value);
    updateSearch({
      filters: { ...filters, [key]: nextValues },
      page: 1,
    });
  }

  const trending = ACTRESS_SORT_OPTIONS.filter((o) => o.group === "Trending");
  const otherSorts = ACTRESS_SORT_OPTIONS.filter((o) => !o.group);

  const hasActiveFilters =
    filters.labels.length > 0 ||
    filters.genres.length > 0 ||
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

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium",
              "hover:bg-muted",
            )}
          >
            <ArrowUpDown className="size-3.5" />
            {sortLabel(sort)}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
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

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium",
              "hover:bg-muted",
              filters.labels.length > 0 && "border-primary/50 text-primary",
            )}
          >
            Label
            {filters.labels.length > 0 ? ` (${filters.labels.length})` : ""}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Label (OR)</DropdownMenuLabel>
              {labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label}
                  checked={filters.labels.includes(label)}
                  onCheckedChange={(checked) => toggleListValue("labels", label, Boolean(checked))}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium",
              "hover:bg-muted",
              filters.genres.length > 0 && "border-primary/50 text-primary",
            )}
          >
            Genre
            {filters.genres.length > 0 ? ` (${filters.genres.length})` : ""}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Genre (OR)</DropdownMenuLabel>
              {genres.map((genre) => (
                <DropdownMenuCheckboxItem
                  key={genre}
                  checked={filters.genres.includes(genre)}
                  onCheckedChange={(checked) => toggleListValue("genres", genre, Boolean(checked))}
                >
                  {genre}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium",
            "hover:bg-muted",
            moreOpen && "bg-muted",
          )}
        >
          <ListFilter className="size-3.5" />
          More filters
          <ChevronDown className={cn("size-3.5 opacity-60 transition-transform", moreOpen && "rotate-180")} />
        </button>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => updateSearch({ filters: { ...DEFAULT_ACTRESS_FILTERS }, page: 1 })}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleContent>
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-medium text-muted-foreground">Cup size</p>
              <div className="flex flex-wrap gap-1.5">
                {cups.map((cup) => {
                  const active = filters.cups.includes(cup);
                  return (
                    <button
                      key={cup}
                      type="button"
                      onClick={() => toggleListValue("cups", cup, !active)}
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
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Min"
                    className="h-8"
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
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Max"
                    className="h-8"
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
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={98}
                  placeholder="18"
                  className="h-8"
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
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={19}
                  max={99}
                  placeholder="99"
                  className="h-8"
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
