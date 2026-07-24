import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { genreCollections, type GenreCollection, type GenreMovie } from "#/libs/movies";

interface MovieCardProps {
  movie: GenreMovie;
  forcePlaceholder?: boolean;
}

function MovieCard({ movie, forcePlaceholder }: MovieCardProps) {
  return (
    <a
      href="#"
      className="group relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card/40 transition-all hover:border-primary/50 hover:shadow-[0_0_35px_-12px_var(--color-primary)] sm:w-80"
    >
      <div className="relative aspect-video w-full">
        <img
          src={forcePlaceholder ? "https://placehold.co/1280x720" : movie.image || "https://placehold.co/1280x720"}
          alt={movie.title}
          className="h-full w-full object-cover transition-transform duration-500 scale-101 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h4 className="text-sm font-semibold tracking-tight sm:text-base">{movie.title}</h4>
          <p className="text-xs text-muted-foreground">
            {movie.year} • {movie.rating}
          </p>
        </div>
      </div>
    </a>
  );
}

interface GenreRowProps {
  collection: GenreCollection;
}

function GenreRow({ collection }: GenreRowProps) {
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
  }, [updateScrollState, collection.movies.length]);

  const scrollByDirection = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  if (collection.movies.length === 0) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 px-6 sm:px-10 lg:px-16">
        <div>
          <h3 className="text-pretty text-xl font-semibold tracking-tight sm:text-2xl">{collection.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{collection.blurb}</p>
        </div>
        <a
          href="#"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-accent"
        >
          More
          <ArrowRight className="size-4" />
        </a>
      </div>

      <div className="relative mt-4">
        {canScrollLeft && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => scrollByDirection("left")}
            aria-label={`Scroll ${collection.name} backward`}
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full sm:left-4 sm:flex group-hover:flex"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}

        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden px-6 sm:px-10 lg:px-16 scroll-pl-6 sm:scroll-pl-10 lg:scroll-pl-16"
        >
          {collection.movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} forcePlaceholder={false} />
          ))}
        </div>

        {canScrollRight && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => scrollByDirection("right")}
            aria-label={`Scroll ${collection.name} forward`}
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full sm:right-4 sm:flex group-hover:flex"
          >
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function GenreSection() {
  return (
    <section id="genres" className="relative py-16 sm:py-24">
      <div className="px-6 sm:px-10 lg:px-16">
        <h2 className="text-pretty text-2xl font-semibold tracking-tight sm:text-4xl">Explore by genre</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Whatever mood you&apos;re in, there&apos;s a shelf for it. Pick a lane and let the night unfold.
        </p>
      </div>

      <div className="mt-8 space-y-12">
        {genreCollections.map((collection) => (
          <GenreRow key={collection.id} collection={collection} />
        ))}
      </div>
    </section>
  );
}
