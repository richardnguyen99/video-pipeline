import { ArrowRight } from "lucide-react";
import { genres } from "@/lib/movies";

export default function GenreSection() {
  return (
    <section id="genres" className="relative py-16 sm:py-24">
      <div className="w-full px-6 sm:px-10 lg:px-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-pretty text-2xl font-semibold tracking-tight sm:text-4xl">Explore by genre</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Whatever mood you&apos;re in, there&apos;s a shelf for it. Pick a lane and let the night unfold.
            </p>
          </div>
          <a
            href="#"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-accent sm:inline-flex"
          >
            View all
            <ArrowRight className="size-4" />
          </a>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {genres.map((genre) => (
            <a
              key={genre.id}
              href="#"
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/40 transition-all hover:border-primary/50 hover:shadow-[0_0_35px_-12px_var(--color-primary)]"
            >
              <div className="relative aspect-4/5 w-full sm:aspect-3/4">
                <img
                  src={genre.image || "/placeholder.svg"}
                  alt={`${genre.name} movies`}
                  className="w-full h-full object-cover transition-transform duration-500 scale-101 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{genre.name}</h3>
                  <p className="text-xs text-muted-foreground">{genre.count}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Browse
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
