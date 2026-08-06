import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Video } from "@/mocks/videos";
import { mockVideos } from "@/mocks/videos";

const SLIDE_DURATION = 6000;
const PARALLAX_FACTOR = 0.35;
const FEATURED_COUNT = 6;

function getThumbnail(video: Video): string {
  return video.image_urls?.[0] ?? video.video_image_url?.[0]?.url ?? "https://placehold.co/1920x1080";
}

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const featuredVideos = mockVideos.slice(0, FEATURED_COUNT);

export default function HeroSection() {
  const [active, setActive] = useState(0);
  const [parallaxY, setParallaxY] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((index: number) => {
    setActive((index + featuredVideos.length) % featuredVideos.length);
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setActive((prev) => (prev + 1) % featuredVideos.length);
    }, SLIDE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  useEffect(() => {
    function handleScroll() {
      setParallaxY(window.scrollY * PARALLAX_FACTOR);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const current = featuredVideos[active];

  return (
    <section id="trending" className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 z-0">
        {featuredVideos.map((video, i) => (
          <div
            key={video.video_id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              active === i ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={getThumbnail(video)}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              className="absolute inset-0 h-[120%] w-full object-cover will-change-transform"
              style={{
                transform: `translate3d(0, ${parallaxY}px, 0)`,
              }}
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

            {featuredVideos.map((video, i) => (
              <div
                key={video.video_id}
                className={active === i ? "block animate-in fade-in slide-in-from-bottom-4 duration-700" : "hidden"}
              >
                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium">
                  {video.maker ? (
                    <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">
                      {video.maker.name}
                    </span>
                  ) : null}
                  {video.release_date ? (
                    <span className="text-muted-foreground">{video.release_date.slice(0, 4)}</span>
                  ) : null}
                  {video.duration ? (
                    <span className="text-muted-foreground">{formatDuration(video.duration)}</span>
                  ) : null}
                </div>

                <h1 className="mt-4 text-pretty text-5xl font-semibold tracking-tight sm:text-7xl">
                  <Link
                    to="/videos/$video_id"
                    params={{ video_id: video.video_id }}
                    className="hover:text-primary transition-colors"
                  >
                    {video.cid}
                  </Link>
                </h1>

                {video.actresses && video.actresses.length > 0 ? (
                  <p className="mt-2 text-base font-medium text-primary sm:text-lg">
                    {video.actresses
                      .slice(0, 3)
                      .map((a) => a.name)
                      .join(" · ")}
                  </p>
                ) : null}

                {video.genres && video.genres.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {video.genres.slice(0, 5).map((g) => (
                      <span
                        key={g.id}
                        className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className="gap-2"
                    nativeButton={false}
                    render={<Link to="/videos/$video_id" params={{ video_id: video.video_id }} />}
                  >
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
        {featuredVideos.map((video, i) => (
          <button
            key={video.video_id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show ${video.title}`}
            aria-pressed={active === i}
            className="group relative h-1.5 overflow-hidden rounded-full bg-border transition-all"
            style={{ width: active === i ? 44 : 20 }}
          >
            {active === i ? (
              <span
                key={active}
                className="absolute inset-y-0 left-0 block rounded-full bg-primary"
                style={{
                  animation: `hero-progress ${SLIDE_DURATION}ms linear forwards`,
                }}
              />
            ) : null}
            <span className="absolute inset-0 rounded-full bg-primary/40 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <span className="sr-only">Now featuring {current.title}</span>
    </section>
  );
}
