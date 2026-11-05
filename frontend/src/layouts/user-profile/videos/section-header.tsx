import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  viewAllTo?:
    | "/u/$username/videos/history"
    | "/u/$username/videos/liked"
    | "/u/$username/videos/public"
    | "/u/$username/playlists";
  username?: string;
};

export function SectionHeader({ title, subtitle, viewAllTo, username }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>

        {subtitle ? <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p> : null}
      </div>

      {viewAllTo != null && username != null ? (
        <Link
          to={viewAllTo}
          params={{ username }}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-0.5 text-sm font-medium transition-colors"
        >
          View all
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
