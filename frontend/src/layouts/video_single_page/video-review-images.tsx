import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Video } from "@/mocks/videos";
import { cn } from "@/libs/utils";

interface VideoReviewImagesProps {
  video: Video;
  className?: string;
}

const EDGE_EPS = 4;
/** First N / last N indicator clicks do not center-scroll (edge positions). */
const EDGE_NO_SCROLL = 2;

/** Last path segment of a URL (e.g. `photo.jpg` from `…/path/photo.jpg?x=1`). */
function imageFileName(url: string): string {
  try {
    const path = new URL(url, "https://local.invalid").pathname;
    const segment = path.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : url;
  } catch {
    const segment = url.split("?")[0]?.split("/").filter(Boolean).pop();
    return segment ?? url;
  }
}

export function VideoReviewImages({ video, className }: VideoReviewImagesProps) {
  const images = video.sample_image_url ?? [];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightboxIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightboxIndex((i) => Math.min(images.length - 1, i + 1));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, images.length]);

  function scrollToIndex(index: number) {
    const el = scrollerRef.current;
    if (!el) return;

    const n = images.length;
    if (n === 0) return;

    const clamped = Math.min(n - 1, Math.max(0, index));
    const maxScroll = getMaxScroll();

    if (clamped < EDGE_NO_SCROLL) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    if (clamped >= n - EDGE_NO_SCROLL) {
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }

    const child = el.querySelector<HTMLElement>(`[data-sample-index="${clamped}"]`);
    if (!child) return;

    const target = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
    const left = Math.min(maxScroll, Math.max(0, target));
    el.scrollTo({ left, behavior: "smooth" });
  }

  function scrollByDir(dir: -1 | 1) {
    scrollToIndex(activeIndex + dir);
  }

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  if (images.length === 0) return null;

  const indicatorIndexes = images
    .map((_, i) => i)
    .filter((i) => i >= EDGE_NO_SCROLL && i < images.length - EDGE_NO_SCROLL);

  const indicatorActive =
    activeIndex < EDGE_NO_SCROLL
      ? (indicatorIndexes[0] ?? -1)
      : activeIndex >= images.length - EDGE_NO_SCROLL
        ? (indicatorIndexes.at(-1) ?? -1)
        : activeIndex;

  const lightboxImage = images[Math.min(lightboxIndex, images.length - 1)];
  const lightboxTitle = imageFileName(lightboxImage.url);

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
              <button
                type="button"
                className="relative aspect-video w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted outline-none ring-offset-background transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => openLightbox(i)}
                aria-label={`Expand sample ${i + 1}`}
              >
                <img
                  src={image.url}
                  alt={`Sample ${i + 1}`}
                  className="size-full object-cover"
                  loading={i < 3 ? "eager" : "lazy"}
                  draggable={false}
                />
              </button>
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

      <div
        className="mt-3 flex items-center justify-center gap-1.5 empty:hidden"
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
                i === indicatorActive ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
              )}
              onClick={() => scrollToIndex(i)}
            />
          );
        })}
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="w-[min(96vw,1280px)] max-w-[min(96vw,1280px)] gap-0 p-0 sm:max-w-[min(96vw,1280px)]">
          <DialogHeader className="border-b border-border px-4 py-3 sm:px-5">
            <DialogTitle className="min-w-0 truncate font-mono text-sm font-medium sm:text-base">
              {lightboxTitle}
            </DialogTitle>
            <DialogClose />
          </DialogHeader>

          <div className="relative flex items-center justify-center bg-black px-12 py-3 sm:px-14">
            <div className="relative aspect-video w-full max-w-7xl overflow-hidden bg-zinc-950">
              <div
                className="flex size-full transition-transform duration-300 ease-out"
                style={{
                  width: `${images.length * 100}%`,
                  transform: `translateX(-${(lightboxIndex / images.length) * 100}%)`,
                }}
              >
                {images.map((image, i) => (
                  <div key={image.id} className="relative h-full shrink-0" style={{ width: `${100 / images.length}%` }}>
                    <img
                      src={image.url}
                      alt={imageFileName(image.url)}
                      width={1280}
                      height={720}
                      className="size-full object-contain"
                      draggable={false}
                      loading={Math.abs(i - lightboxIndex) <= 1 ? "eager" : "lazy"}
                    />
                  </div>
                ))}
              </div>
            </div>

            {lightboxIndex > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute top-1/2 left-2 z-10 size-9 -translate-y-1/2 rounded-full shadow-md sm:left-3"
                aria-label="Previous image"
                onClick={() => setLightboxIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="size-5" />
              </Button>
            ) : null}

            {lightboxIndex < images.length - 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute top-1/2 right-2 z-10 size-9 -translate-y-1/2 rounded-full shadow-md sm:right-3"
                aria-label="Next image"
                onClick={() => setLightboxIndex((i) => Math.min(images.length - 1, i + 1))}
              >
                <ChevronRight className="size-5" />
              </Button>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div
              className="flex items-center justify-center gap-1.5 border-t border-border px-4 py-3"
              role="tablist"
              aria-label="Lightbox image position"
            >
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  role="tab"
                  aria-selected={i === lightboxIndex}
                  aria-label={`View sample ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === lightboxIndex
                      ? "w-5 bg-primary"
                      : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
                  )}
                  onClick={() => setLightboxIndex(i)}
                />
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
