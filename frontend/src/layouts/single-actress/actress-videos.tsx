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
import { buildActressVideoSearch } from "@/libs/actress-videos";
import { buttonVariants } from "@/libs/shadcn_variants";
import type { Video } from "@/mocks/videos";
import { cn } from "@/libs/utils";

interface ActressVideosProps {
  videos: Video[];
  total: number;
  page: number;
  totalPages: number;
  sort: ActressVideoSort;
  filters: ActressVideoFilters;
  allVideos: Video[];
  className?: string;
}

export function ActressVideos({
  videos,
  total,
  page,
  totalPages,
  sort,
  filters,
  allVideos,
  className,
}: ActressVideosProps) {
  const { actressId } = useParams({ from: "/actresses/$actressId" });
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
  );

  function pageSearch(targetPage: number) {
    return buildActressVideoSearch({ page: targetPage, sort, filters });
  }

  return (
    <section className={cn("mx-auto w-full px-6 py-10 sm:px-10 lg:px-16", className)}>
      <header className="mb-6">
        <h2 className="text-pretty text-2xl font-semibold tracking-tight sm:text-3xl">Featured videos</h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {total} {total === 1 ? "video" : "videos"}
        </p>
      </header>

      <ActressVideosToolbar sort={sort} filters={filters} allVideos={allVideos} />

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

      {totalPages > 1 ? (
        <Pagination className="mt-10">
          <PaginationContent>
            <PaginationItem>
              {prevPage != null ? (
                <Link
                  to="/actresses/$actressId"
                  params={{ actressId }}
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
              const showEllipsis = i > 0 && p - pageNumbers[i - 1] > 1;
              return (
                <PaginationItem key={p}>
                  {showEllipsis ? <PaginationEllipsis /> : null}
                  <Link
                    to="/actresses/$actressId"
                    params={{ actressId }}
                    search={pageSearch(p)}
                    aria-label={`Go to page ${p}`}
                    aria-current={p === page ? "page" : undefined}
                    className={cn(
                      buttonVariants({
                        variant: p === page ? "outline" : "ghost",
                        size: "icon",
                      }),
                    )}
                  >
                    {p}
                  </Link>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              {nextPage != null ? (
                <Link
                  to="/actresses/$actressId"
                  params={{ actressId }}
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
    </section>
  );
}
