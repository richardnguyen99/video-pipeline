import { Link } from "@tanstack/react-router";

import type { NamedEntity } from "@/mocks/videos";

export interface GenreTagProps {
  genre: NamedEntity;
  asListItem?: boolean;
}

export function GenreTag({ genre, asListItem = true }: GenreTagProps) {
  const tag = (
    <Link
      to="/videos"
      search={{ genre: [genre.id] }}
      className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm no-underline hover:bg-secondary/80 hover:no-underline"
    >
      {genre.name}
    </Link>
  );

  if (asListItem) {
    return <li>{tag}</li>;
  }

  return tag;
}
