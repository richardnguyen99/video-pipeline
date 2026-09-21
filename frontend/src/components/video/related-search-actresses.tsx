import { useSuspenseQuery } from "@tanstack/react-query";

import { ActressCard } from "@/components/actress/actress-card";
import { actressListQueryOptions } from "@/queries/actresses";

export const RELATED_SEARCH_ACTRESSES_LIMIT = 5;

interface RelatedSearchActressesProps {
  q: string;
}

export function RelatedSearchActresses({ q }: RelatedSearchActressesProps) {
  const term = q.trim();
  const { data } = useSuspenseQuery(
    actressListQueryOptions({
      page: 1,
      pageSize: RELATED_SEARCH_ACTRESSES_LIMIT,
      q: term || undefined,
    }),
  );

  if (!term) {
    return null;
  }

  const actresses = data.items.slice(0, RELATED_SEARCH_ACTRESSES_LIMIT);

  if (actresses.length === 0) {
    return null;
  }

  return (
    <section className="mb-6" aria-label="Matching actresses">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {actresses.map((actress) => (
          <li key={actress.id} className="h-full min-w-0">
            <ActressCard actress={actress} className="h-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}
