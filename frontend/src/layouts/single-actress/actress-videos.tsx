import { useLayoutEffect } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { CategoryVideoCard } from "@/components/video/category-video-card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { ActressVideosToolbar } from "@/layouts/single-actress/actress-videos-toolbar";
import type { ActressVideoFilters, ActressVideoSort } from "@/libs/actress-videos";
import { ACTRESS_VIDEO_PAGE_SIZE, buildActressVideoSearch } from "@/libs/actress-videos";
import { buttonVariants } from "@/libs/shadcn_variants";
import type { Video } from "@/mocks/videos";
import { captureScrollPosition, cn, restoreScrollPosition } from "@/libs/utils";

interface ActressVideosShellProps {
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
  children: React.ReactNode;
  className?: string;
}

export function ActressVideosShell({ sort, filters, children, className }: ActressVideosShellProps) {
  return (
    <section className={cn("mx-auto w-full px-6 py-10 sm:px-10 lg:px-16", className)}>
      <header className="mb-6">
        <h2 className="text-pretty text-2xl font-semibold tracking-tight sm:text-3xl">Featured videos</h2>
      </header>

      <ActressVideosToolbar sort={sort} filters={filters} />

      {children}
    </section>
  );
}

interface ActressVideosGridProps {
  videos: Video[];
  total: number;
  page: number;
  totalPages: number;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
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

export function ActressVideosGrid({ videos, total, page, totalPages, sort, filters }: ActressVideosGridProps) {
  const { actressId } = useParams({ from: "/actresses/$actressId" });
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const pageNumbers = buildPageNumbers(page, totalPages);

  function pageSearch(targetPage: number) {
    return buildActressVideoSearch({ page: targetPage, sort, filters });
  }

  useLayoutEffect(() => {
    restoreScrollPosition();
  }, [videos, sort, filters, page]);

  return (
    <>
      {total === 0 ? <p className="text-sm text-muted-foreground">No videos match these filters.</p> : null}

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: ACTRESS_VIDEO_PAGE_SIZE }, (_, index) => {
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

      {total > 0 ? (
        <Pagination className="mt-10">
          <PaginationContent className="flex-nowrap">
            <PaginationItem>
              {prevPage != null ? (
                <Link
                  to="/actresses/$actressId"
                  params={{ actressId }}
                  search={pageSearch(prevPage)}
                  resetScroll={false}
                  onClick={() => captureScrollPosition()}
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

            {pageNumbers.flatMap((p, i) => {
              const prev = i > 0 ? pageNumbers.at(i - 1) : undefined;
              const showEllipsis = prev !== undefined && p - prev > 1;
              const nodes = [];

              if (showEllipsis) {
                nodes.push(
                  <PaginationItem key={`ellipsis-${p}`}>
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              nodes.push(
                <PaginationItem key={p}>
                  <Link
                    to="/actresses/$actressId"
                    params={{ actressId }}
                    search={pageSearch(p)}
                    resetScroll={false}
                    onClick={() => captureScrollPosition()}
                    aria-label={`Go to page ${p}`}
                    aria-current={p === page ? "page" : undefined}
                    className={cn(
                      buttonVariants({
                        variant: p === page ? "default" : "outline",
                        size: "default",
                      }),
                      "h-9 min-w-9 justify-center px-2.5 tabular-nums",
                    )}
                  >
                    {p}
                  </Link>
                </PaginationItem>,
              );

              return nodes;
            })}

            <PaginationItem>
              {nextPage != null ? (
                <Link
                  to="/actresses/$actressId"
                  params={{ actressId }}
                  search={pageSearch(nextPage)}
                  resetScroll={false}
                  onClick={() => captureScrollPosition()}
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

export function ActressVideos({
  videos,
  total,
  page,
  totalPages,
  sort,
  filters,
  className,
}: {
  videos: Video[];
  total: number;
  page: number;
  totalPages: number;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
  className?: string;
}) {
  return (
    <ActressVideosShell sort={sort} filters={filters} className={className}>
      <p className="mb-6 flex h-5 items-center text-sm text-muted-foreground sm:text-base">
        {total} {total === 1 ? "video" : "videos"}
      </p>
      <ActressVideosGrid
        videos={videos}
        total={total}
        page={page}
        totalPages={totalPages}
        sort={sort}
        filters={filters}
      />
    </ActressVideosShell>
  );
}
