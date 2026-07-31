import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Video } from "@/mocks/videos";
import { cn } from "@/libs/utils";

interface VideoReviewImagesProps {
  video: Video;
  className?: string;
}

const EDGE_EPS = 4;
/** First N / last N indicator clicks do not center-scroll (edge positions). */
const EDGE_NO_SCROLL = 2;

export function VideoReviewImages({ video, className }: VideoReviewImagesProps) {
  const images = video.sample_image_url ?? [];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const getMaxScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return 0;

    return Math.max(0, el.scrollWidth - el.clientWidth);
  }, []);

  const getChildren = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return [] as HTMLElement[];

    return Array.from(el.querySelectorAll<HTMLElement>("[data-sample-index]"));
  }, []);

  const findCenterIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return 0;

    const children = getChildren();
    if (children.length === 0) return 0;

    const centerX = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;

    children.forEach((child) => {
      const i = Number(child.dataset.sampleIndex);
      const mid = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(mid - centerX);

      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });

    return closest;
  }, [getChildren]);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const { scrollLeft } = el;
    const maxScroll = getMaxScroll();

    setCanScrollPrev(scrollLeft > EDGE_EPS);
    setCanScrollNext(scrollLeft < maxScroll - EDGE_EPS);
    setActiveIndex(findCenterIndex());
  }, [findCenterIndex, getMaxScroll]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });

    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, images.length]);

  /**
   * Scroll policy:
   * - First 2 indicators → stay at start (scrollLeft = 0)
   * - Last 2 indicators → stay at end (scrollLeft = maxScroll), last card right-aligned
   * - Otherwise → center that image in the viewport
   */
  function scrollToIndex(index: number) {
    const el = scrollerRef.current;
    if (!el) return;

    const n = images.length;
    if (n === 0) return;

    const clamped = Math.min(n - 1, Math.max(0, index));
    const maxScroll = getMaxScroll();

    // First two: do not scroll — pin to start
    if (clamped < EDGE_NO_SCROLL) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    // Last two: pin to end — last element flush to the right
    if (clamped >= n - EDGE_NO_SCROLL) {
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }

    const child = el.querySelector<HTMLElement>(`[data-sample-index="${clamped}"]`);
    if (!child) return;

    // Center the target image in the viewport
    const target = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
    const left = Math.min(maxScroll, Math.max(0, target));
    el.scrollTo({ left, behavior: "smooth" });
  }

  function scrollByDir(dir: -1 | 1) {
    scrollToIndex(activeIndex + dir);
  }

  if (images.length === 0) return null;

  // Dots only for indexes that can be centered (skip first/last EDGE_NO_SCROLL)
  const indicatorIndexes = images
    .map((_, i) => i)
    .filter((i) => i >= EDGE_NO_SCROLL && i < images.length - EDGE_NO_SCROLL);

  // Map center index onto the visible indicator range when near edges
  const indicatorActive =
    indicatorIndexes.length === 0
      ? -1
      : activeIndex < EDGE_NO_SCROLL
        ? indicatorIndexes[0]
        : activeIndex >= images.length - EDGE_NO_SCROLL
          ? indicatorIndexes[indicatorIndexes.length - 1]
          : activeIndex;

  return (
    <section className={cn("relative mt-6", className)} aria-label="Sample images">
      <div className="relative">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-background to-transparent transition-opacity",
            canScrollPrev ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-background to-transparent transition-opacity",
            canScrollNext ? "opacity-100" : "opacity-0",
          )}
        />

        <div
          ref={scrollerRef}
          className={cn(
            "flex gap-3 overflow-x-auto scroll-smooth",
            "snap-x snap-mandatory",
            "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {images.map((image, i) => (
            <figure
              key={image.id}
              data-sample-index={i}
              className={cn(
                "w-[min(72%,20rem)] shrink-0 snap-center snap-always",
                "sm:w-[min(48%,18rem)] lg:w-[min(36%,16rem)]",
              )}
            >
              <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                <img
                  src={image.url}
                  alt={`Sample ${i + 1}`}
                  className="size-full object-cover"
                  loading={i < 3 ? "eager" : "lazy"}
                  draggable={false}
                />
              </div>
            </figure>
          ))}
        </div>

        {canScrollPrev ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute top-1/2 left-2 z-20 size-9 -translate-y-1/2 rounded-full shadow-md"
            aria-label="Previous images"
            onClick={() => scrollByDir(-1)}
          >
            <ChevronLeft className="size-5" />
          </Button>
        ) : null}
        {canScrollNext ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute top-1/2 right-2 z-20 size-9 -translate-y-1/2 rounded-full shadow-md"
            aria-label="Next images"
            onClick={() => scrollByDir(1)}
          >
            <ChevronRight className="size-5" />
          </Button>
        ) : null}
      </div>

      {/* Indicators omit first/last two images — only center-scrollable positions */}
      {indicatorIndexes.length > 0 ? (
        <div
          className="mt-3 flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label="Sample image position"
        >
          {indicatorIndexes.map((i) => {
            const image = images[i];
            return (
              <button
                key={image.id}
                type="button"
                role="tab"
                aria-selected={i === indicatorActive}
                aria-label={`Go to sample ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === indicatorActive
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
                )}
                onClick={() => scrollToIndex(i)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
