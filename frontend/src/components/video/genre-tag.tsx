import type { NamedEntity } from "@/mocks/videos";

import { EntityLink } from "./entity-link";

export interface GenreTagProps {
  genre: NamedEntity;
  asListItem?: boolean;
}

export function GenreTag({ genre, asListItem = true }: GenreTagProps) {
  const tag = (
    <EntityLink
      to={`/genres/${genre.id}`}
      className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm no-underline hover:bg-secondary/80 hover:no-underline"
    >
      {genre.name}
    </EntityLink>
  );

  if (asListItem) {
    return <li>{tag}</li>;
  }

  return tag;
}
