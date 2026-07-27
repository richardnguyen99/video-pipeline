import { createFileRoute } from "@tanstack/react-router";
import { Play } from "lucide-react";

import HeroSection from "@/layouts/home/hero-section";
import GenreSection from "@/layouts/home/genre-section";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <>
      <HeroSection />
      <GenreSection />

      <section className="relative py-16 sm:py-24">
        <div className="w-full px-6 sm:px-10 lg:px-16">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/40 px-6 py-14 text-center shadow-[0_0_60px_-20px_var(--color-primary)] sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background: "radial-gradient(70% 90% at 50% 0%, oklch(0.5 0.2 350 / 0.45) 0%, transparent 70%)",
              }}
            />
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
              Your next favorite film is one tap away
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-balance text-base leading-relaxed text-muted-foreground">
              Join millions streaming ad-free in stunning 4K. Cancel anytime, no strings attached.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="gap-2">
                <Play className="size-4 fill-current" />
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline">
                View Plans
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
