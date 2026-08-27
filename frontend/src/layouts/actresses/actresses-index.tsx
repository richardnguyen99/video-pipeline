import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { ActressCard } from "@/components/actress/actress-card";
import { ActressesToolbar } from "@/layouts/actresses/actresses-toolbar";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import type { ActressFilters, ActressSort, ActressSummary } from "@/libs/actresses";
import { buildActressesSearch } from "@/libs/actresses";
import { buttonVariants } from "@/libs/shadcn_variants";
import { cn } from "@/libs/utils";

interface ActressesShellProps {
  sort: ActressSort;
  filters: ActressFilters;
  totalSlot?: React.ReactNode;
  total?: number;
  children: React.ReactNode;
}

export function ActressesShell({ sort, filters, totalSlot, total, children }: ActressesShellProps) {
  return (
    <div className="min-h-screen pt-16">
      <div className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-16">
        <header className="mb-8">
          <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">Actresses</h1>
          <div className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Browse performers and their featured titles.
            {totalSlot}
            {typeof total === "number" ? ` ${total} profiles.` : null}
          </div>
        </header>

        <ActressesToolbar sort={sort} filters={filters} />

        {children}
      </div>
    </div>
  );
}

interface ActressesGridProps {
  actresses: ActressSummary[];
  page: number;
  totalPages: number;
  sort: ActressSort;
  filters: ActressFilters;
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

export function ActressesGrid({ actresses, page, totalPages, sort, filters }: ActressesGridProps) {
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const pageNumbers = buildPageNumbers(page, totalPages);

  function pageSearch(targetPage: number) {
    return buildActressesSearch({ page: targetPage, sort, filters });
  }

  return (
    <>
      {actresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No actresses found.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {actresses.map((actress) => (
            <li key={actress.id} className="h-full min-w-0">
              <ActressCard actress={actress} className="h-full" />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <Pagination className="mt-10">
          <PaginationContent>
            <PaginationItem>
              {prevPage != null ? (
                <Link
                  to="/actresses"
                  search={pageSearch(prevPage)}
                  aria-label="Go to previous page"
                  className={cn(buttonVariants({ variant: "outline", size: "default" }), "gap-1 px-2.5 sm:pr-2.5")}
                >
                  <ChevronLeftIcon className="size-4" />
                  <span className="hidden sm:block">Previous</span>
                </Link>
              ) : (
                <PaginationLink
                  aria-disabled
                  aria-label="Go to previous page"
                  className="pointer-events-none gap-1 px-2.5 opacity-50 sm:pr-2.5"
                  size="default"
                  tabIndex={-1}
                >
                  <ChevronLeftIcon className="size-4" />
                  <span className="hidden sm:block">Previous</span>
                </PaginationLink>
              )}
            </PaginationItem>

            {pageNumbers.map((p, i) => {
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
                      to="/actresses"
                      search={pageSearch(p)}
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
              {nextPage != null ? (
                <Link
                  to="/actresses"
                  search={pageSearch(nextPage)}
                  aria-label="Go to next page"
                  className={cn(buttonVariants({ variant: "outline", size: "default" }), "gap-1 px-2.5 sm:pl-2.5")}
                >
                  <span className="hidden sm:block">Next</span>
                  <ChevronRightIcon className="size-4" />
                </Link>
              ) : (
                <PaginationLink
                  aria-disabled
                  aria-label="Go to next page"
                  className="pointer-events-none gap-1 px-2.5 opacity-50 sm:pl-2.5"
                  size="default"
                  tabIndex={-1}
                >
                  <span className="hidden sm:block">Next</span>
                  <ChevronRightIcon className="size-4" />
                </PaginationLink>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </>
  );
}

export function ActressesIndex({
  actresses,
  page,
  totalPages,
  total,
  sort,
  filters,
}: {
  actresses: ActressSummary[];
  page: number;
  totalPages: number;
  total: number;
  sort: ActressSort;
  filters: ActressFilters;
}) {
  return (
    <ActressesShell sort={sort} filters={filters} total={total}>
      <ActressesGrid actresses={actresses} page={page} totalPages={totalPages} sort={sort} filters={filters} />
    </ActressesShell>
  );
}
