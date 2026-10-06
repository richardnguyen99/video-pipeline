import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type LibraryViewAllPath = "/u/$username/videos/history" | "/u/$username/videos/liked";

type SectionHeaderProps = {
  title: string;
  subtitle: string;
  viewAllTo?: LibraryViewAllPath;
  username?: string;
};

export function SectionHeader({ title, subtitle, viewAllTo, username }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>

        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {viewAllTo != null && username != null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link to={viewAllTo} params={{ username }} />}
        >
          View all
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm">
          View all
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
