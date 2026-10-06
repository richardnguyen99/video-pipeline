import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type SectionHeaderProps = {
  title: string;
  subtitle: string;
};

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>

        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Button type="button" variant="ghost" size="sm">
        View all
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
