import { Clapperboard, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CtaFooter() {
  return (
    <>
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

      <footer className="border-t border-border/60">
        <div className="flex w-full flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row sm:px-10 lg:px-16">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clapperboard className="size-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Velvet</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">
              About
            </a>
            <a href="#genres" className="transition-colors hover:text-foreground">
              Genres
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Support
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Privacy
            </a>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Velvet Media</p>
        </div>
      </footer>
    </>
  );
}
