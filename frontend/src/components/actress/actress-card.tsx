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
      <div className="flex flex-col items-center gap-3 xs:flex-row xs:items-stretch xs:gap-3">
        <span
          className={cn(
            "size-[min(7.5rem,36vw)] shrink-0 overflow-hidden rounded-full border border-border bg-muted xs:size-[120px]",
          )}
        >
          {actress.image_url ? (
            <img
              src={actress.image_url}
              alt=""
              width={120}
              height={120}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-xl font-semibold text-muted-foreground">
              {actress.name.slice(0, 1)}
            </span>
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-center xs:items-start xs:text-left">
          <h2 className="line-clamp-1 w-full text-base font-semibold tracking-tight xs:text-lg">{actress.name}</h2>
          <p className={cn("line-clamp-1 w-full text-sm", actress.ruby ? "text-muted-foreground" : "invisible")}>
            {actress.ruby ?? "\u00A0"}
          </p>
          <p className={cn("line-clamp-1 w-full text-sm", birthdayLabel ? "text-muted-foreground" : "invisible")}>
            {birthdayLabel ?? "\u00A0"}
          </p>
          <p className={cn("line-clamp-1 w-full text-sm", measurements ? "text-muted-foreground" : "invisible")}>
            {measurements ?? "\u00A0"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground xs:justify-start">
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
    </Link>
  );
}
