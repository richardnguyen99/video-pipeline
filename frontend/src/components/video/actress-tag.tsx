import type { ActressRef } from "@/mocks/videos";

import { EntityLink } from "./entity-link";

export interface ActressTagProps {
  actress: ActressRef;
  asListItem?: boolean;
}

export function ActressTag({ actress, asListItem = true }: ActressTagProps) {
  const tag = (
    <EntityLink
      to={`/actresses/${actress.id}`}
      className="inline-flex items-center gap-2 rounded-full bg-secondary py-1 pr-3 pl-1 text-sm no-underline hover:bg-secondary/80 hover:no-underline"
    >
      <span className="size-7 shrink-0 overflow-hidden rounded-full bg-muted">
        {actress.image_url ? (
          <img src={actress.image_url} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {actress.name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="line-clamp-1">{actress.name}</span>
    </EntityLink>
  );

  if (asListItem) {
    return <li>{tag}</li>;
  }

  return tag;
}
