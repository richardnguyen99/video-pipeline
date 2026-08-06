import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryVideoCard } from "@/components/video/category-video-card";
import type { Video } from "@/mocks/videos";
import { mockVideos } from "@/mocks/videos";

/** Link targets aligned with `routeTree.gen.ts` FileRoutesByPath. */
type CategoryMoreLink = { to: "/latest" } | { to: "/for-you" } | { to: "/genres/$genre"; params: { genre: string } };

interface CategoryCollection {
  id: string;
  name: string;
  blurb: string;
  more: CategoryMoreLink;
  videos: Video[];
}

function sortByReleaseDesc(videos: Video[]): Video[] {
  return [...videos].sort((a, b) => {
    const da = a.release_date ? Date.parse(a.release_date) : 0;
    const db = b.release_date ? Date.parse(b.release_date) : 0;
    return db - da;
  });
}

function buildCategoryCollections(videos: Video[]): CategoryCollection[] {
  const latest = sortByReleaseDesc(videos);
  const forYou = [...videos].sort((a, b) => a.id - b.id);

  const genreMap = new Map<string, { id: number; name: string; videos: Video[] }>();
  for (const video of videos) {
    for (const genre of video.genres ?? []) {
      const entry = genreMap.get(genre.name) ?? {
        id: genre.id,
        name: genre.name,
        videos: [],
      };
      if (!entry.videos.some((v) => v.video_id === video.video_id)) {
        entry.videos.push(video);
      }
      genreMap.set(genre.name, entry);
    }
  }

  const genreCategories = [...genreMap.values()]
    .sort((a, b) => b.videos.length - a.videos.length || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((g) => ({
      id: `genre-${g.id}`,
      name: g.name,
      blurb: `Browse ${g.name.toLowerCase()} titles`,
      more: {
        to: "/genres/$genre" as const,
        params: { genre: g.name.toLowerCase().replace(/\s+/g, "-") },
      },
      videos: g.videos,
    }));

  return [
    {
      id: "latest",
      name: "Latest",
      blurb: "Fresh releases just added",
      more: { to: "/latest" },
      videos: latest,
    },
    {
      id: "for-you",
      name: "For you",
      blurb: "Picks tailored to your taste",
      more: { to: "/for-you" },
      videos: forYou,
    },
    ...genreCategories,
  ];
}

const moreLinkClassName =
  "inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-active";

function CategoryMoreLinkButton({ more }: { more: CategoryMoreLink }) {
  if (more.to === "/genres/$genre") {
    return (
      <Link to="/genres/$genre" params={more.params} className={moreLinkClassName}>
        More
        <ArrowRight className="size-4" />
      </Link>
    );
  }

  return (
    <Link to={more.to} className={moreLinkClassName}>
      More
      <ArrowRight className="size-4" />
    </Link>
  );
}

interface CategoryRowProps {
  collection: CategoryCollection;
}

function CategoryRow({ collection }: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(el);
    el.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, collection.videos.length]);

  const scrollByDirection = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  if (collection.videos.length === 0) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 px-6 sm:px-10 lg:px-16">
        <div>
          <h3 className="text-pretty text-xl font-semibold tracking-tight sm:text-2xl">{collection.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{collection.blurb}</p>
        </div>
        <CategoryMoreLinkButton more={collection.more} />
      </div>

      <div className="relative mt-4">
        {canScrollLeft ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => scrollByDirection("left")}
            aria-label={`Scroll ${collection.name} backward`}
            className="absolute top-1/2 left-2 z-10 hidden -translate-y-1/2 rounded-full sm:left-4 sm:flex"
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}

        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-6 pb-2 scrollbar-none scroll-pl-6 sm:px-10 sm:scroll-pl-10 lg:px-16 lg:scroll-pl-16 [&::-webkit-scrollbar]:hidden"
        >
          {collection.videos.map((video) => (
            <CategoryVideoCard key={video.video_id} video={video} />
          ))}
        </div>

        {canScrollRight ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => scrollByDirection("right")}
            aria-label={`Scroll ${collection.name} forward`}
            className="absolute top-1/2 right-2 z-10 hidden -translate-y-1/2 rounded-full sm:right-4 sm:flex"
          >
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function CategorySection() {
  const collections = useMemo(() => buildCategoryCollections(mockVideos), []);

  return (
    <section id="categories" className="relative py-16 sm:py-24">
      <div className="px-6 sm:px-10 lg:px-16">
        <h2 className="text-pretty text-2xl font-semibold tracking-tight sm:text-4xl">Browse categories</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Trending picks, new releases, and genres matched to your watchlist.
        </p>
      </div>

      <div className="mt-8 space-y-12">
        {collections.map((collection) => (
          <CategoryRow key={collection.id} collection={collection} />
        ))}
      </div>
    </section>
  );
}
