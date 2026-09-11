import { Link } from "@tanstack/react-router";

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
  return { [filter]: id };
}

export function EntityTag({ entity, filter, to, imageUrl, asListItem = true, className }: EntityTagProps) {
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
          <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {entity.name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="line-clamp-1">{entity.name}</span>
    </>
  ) : (
    entity.name
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
