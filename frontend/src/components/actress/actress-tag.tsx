import { Link } from "@tanstack/react-router";
import { Clapperboard, Eye, MessageCircle, ThumbsUp, UserPlus } from "lucide-react";

import type { ActressSummary } from "@/libs/actresses";
import { formatBirthdayLabel, formatMeasurements } from "@/libs/actresses";
import { cn, formatCompactNumber } from "@/libs/utils";

interface ActressCardProps {
  actress: ActressSummary;
  className?: string;
}

export function ActressCard({ actress, className }: ActressCardProps) {
  const birthdayLabel = formatBirthdayLabel(actress.birthday);
  const measurements = formatMeasurements(actress);

  return (
    <Link
      to="/actresses/$actressId"
      params={{ actressId: String(actress.id) }}
      className={cn(
        "group flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3",
        "shadow-md transition-all hover:border-primary/50 hover:shadow-[0_0_24px_-6px_var(--color-primary)]",
        className,
      )}
    >
      <div className="flex gap-3">
        <span className="size-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {actress.image_url ? (
            <img
              src={actress.image_url}
              alt=""
              width={80}
              height={80}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-xl font-semibold text-muted-foreground">
              {actress.name.slice(0, 1)}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-0.5">
          <h2 className="truncate text-sm font-semibold tracking-tight">{actress.name}</h2>
          {actress.ruby ? <p className="truncate text-xs text-muted-foreground">{actress.ruby}</p> : null}
          {birthdayLabel ? <p className="truncate text-xs text-muted-foreground">{birthdayLabel}</p> : null}
          {measurements ? <p className="line-clamp-2 text-xs text-muted-foreground">{measurements}</p> : null}
        </div>
      </div>

      <div className="min-w-0 space-y-1.5 border-t border-border/60 pt-2">
        <p className="truncate text-sm font-medium">{actress.name}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Videos">
            <Clapperboard className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Videos</span>
            {formatCompactNumber(actress.videoCount)}
          </span>
          <span className="inline-flex items-center gap-1" title="Views">
            <Eye className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Views</span>
            {formatCompactNumber(actress.totalViews)}
          </span>
          <span className="inline-flex items-center gap-1" title="Subscribers">
            <UserPlus className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Subscribers</span>
            {formatCompactNumber(actress.subscribers)}
          </span>
          <span className="inline-flex items-center gap-1" title="Likes">
            <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Likes</span>
            {formatCompactNumber(actress.totalLikes)}
          </span>
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessageCircle className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Comments</span>
            {formatCompactNumber(actress.totalComments)}
          </span>
        </div>
      </div>
    </Link>
  );
}
