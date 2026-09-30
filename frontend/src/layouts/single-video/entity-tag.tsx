import { Link } from "@tanstack/react-router";

import { catalogEntityDisplayName } from "@/mocks/videos";
import type { NamedEntity } from "@/mocks/videos";
import { cn } from "@/libs/utils";

export type EntityVideoFilterKey = "genre" | "maker" | "label" | "director" | "series";

export interface EntityTagProps {
  entity: NamedEntity;
  filter?: EntityVideoFilterKey;
  to?: string;
  imageUrl?: string | null;
  asListItem?: boolean;
  className?: string;
}

function buildVideoSearch(filter: EntityVideoFilterKey, id: number) {
  if (filter === "genre") {
    return { genre: [id] };
  }

  return { [filter]: id };
}

export function EntityTag({ entity, filter, to, imageUrl, asListItem = true, className }: EntityTagProps) {
  const displayName = catalogEntityDisplayName(entity);
  const showAvatar = imageUrl !== undefined;
  const linkClassName = cn(
    showAvatar
      ? "inline-flex items-center gap-2 rounded-full bg-secondary py-1 pr-3 pl-1 text-sm no-underline hover:bg-secondary/80 hover:no-underline"
      : "inline-flex rounded-full bg-secondary px-3 py-1 text-sm no-underline hover:bg-secondary/80 hover:no-underline",
    className,
  );

  const content = showAvatar ? (
    <>
      <span className="size-7 shrink-0 overflow-hidden rounded-full bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="size-full object-cover" loading="eager" decoding="async" />
        ) : (
          <span className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {displayName.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="line-clamp-1">{displayName}</span>
    </>
  ) : (
    displayName
  );

  const tag =
    filter != null ? (
      <Link to="/videos" search={buildVideoSearch(filter, entity.id)} className={linkClassName}>
        {content}
      </Link>
    ) : (
      <Link to={(to ?? "/videos") as "/"} className={linkClassName}>
        {content}
      </Link>
    );

  if (asListItem) {
    return <li>{tag}</li>;
  }

  return tag;
}
