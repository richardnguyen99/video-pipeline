import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Plus, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { featuredMovies } from "#/libs/movies";

const SLIDE_DURATION = 6000;

export default function HeroSection() {
  const [active, setActive] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((index: number): void => {
    setActive((index + featuredMovies.length) % featuredMovies.length);
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setActive((prev) => (prev + 1) % featuredMovies.length);
    }, SLIDE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  return (
    <section id="trending" className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 z-0">
        {featuredMovies.map((m, i) => (
          <div
            key={m.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              active === i ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={m.image || "https://placehold.co/1920x1080"}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-1 bg-linear-to-t from-background via-background/40 to-background/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-1 bg-linear-to-r from-background via-background/70 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-1"
        style={{
          background: "radial-gradient(70% 60% at 15% 40%, oklch(0.4 0.18 350 / 0.35) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-1 items-center">
        <div className="w-full px-6 sm:px-10 lg:px-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-primary" />
              This week&apos;s most-watched
            </span>

            {featuredMovies.map((movie, i) => (
              <div
                key={movie.id}
                className={active === i ? "block animate-in fade-in slide-in-from-bottom-4 duration-700" : "hidden"}
              >
                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1 text-primary">
                    <Star className="size-3 fill-current" />
                    {movie.match}% Match
                  </span>
                  <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">
                    {movie.rating}
                  </span>
                  <span className="text-muted-foreground">{movie.year}</span>
                  <span className="text-muted-foreground">{movie.duration}</span>
                </div>

                <h1 className="mt-4 text-pretty text-5xl font-semibold tracking-tight sm:text-7xl">{movie.title}</h1>
                <p className="mt-2 text-base font-medium text-primary sm:text-lg">{movie.tagline}</p>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {movie.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {movie.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
                    >
                      {g}
                    </span>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button size="lg" className="gap-2">
                    <Play className="size-4 fill-current" />
                    Play Now
                  </Button>
                  <Button size="lg" variant="secondary" className="gap-2">
                    <Plus className="size-4" />
                    My List
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 pb-10">
        {featuredMovies.map((m, i) => (
          <button
            key={m.id}
            onClick={() => goTo(i)}
            aria-label={`Show ${m.title}`}
            aria-pressed={active === i}
            className="group relative h-1.5 overflow-hidden rounded-full bg-border transition-all"
            style={{ width: active === i ? 44 : 20 }}
          >
            {active === i && (
              <span
                key={active}
                className="absolute inset-y-0 left-0 block rounded-full bg-primary"
                style={{
                  animation: `hero-progress ${SLIDE_DURATION}ms linear forwards`,
                }}
              />
            )}
            <span className="absolute inset-0 rounded-full bg-primary/40 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </section>
  );
}
