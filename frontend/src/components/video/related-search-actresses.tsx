import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { ActressCard } from "@/components/actress/actress-card";
import { relatedSearchActressesQueryOptions } from "@/queries/actresses";

export const RELATED_SEARCH_ACTRESSES_LIMIT = 5;

interface RelatedSearchActressesProps {
  q: string;
}

export function RelatedSearchActresses({ q }: RelatedSearchActressesProps) {
  const term = q.trim();
  const { data: actresses } = useSuspenseQuery(
    relatedSearchActressesQueryOptions(term, RELATED_SEARCH_ACTRESSES_LIMIT),
  );

  if (!term || actresses.length === 0) {
    return null;
  }

  return (
    <section className="mb-6" aria-label="Matching actresses">
      <div className="mb-3 flex items-center justify-end">
        <Link
          to="/actresses"
          search={{ q: term }}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-active"
        >
          More
          <ArrowRight className="size-4" />
        </Link>
      </div>

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
