import { createFileRoute, Link } from "@tanstack/react-router";

import { getAllGenres } from "@/libs/category-videos";

export const Route = createFileRoute("/genres/")({
  component: GenresIndexPage,
  loader: () => ({ genres: getAllGenres() }),
});

function GenresIndexPage() {
  const { genres } = Route.useLoaderData();

  return (
    <div className="min-h-screen pt-16">
      <div className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-16">
        <header className="mb-8">
          <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">Genres</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Explore titles by genre.</p>
        </header>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {genres.map((genre) => (
            <li key={genre.id}>
              <Link
                to="/genres/$genre"
                params={{ genre: genre.slug }}
                className="flex flex-col rounded-2xl border border-border bg-card/40 px-4 py-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <span className="text-sm font-semibold tracking-tight sm:text-base">{genre.name}</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {genre.count} {genre.count === 1 ? "title" : "titles"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
