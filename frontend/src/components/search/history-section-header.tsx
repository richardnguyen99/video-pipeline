import { Trash2 } from "lucide-react";

import { cn } from "@/libs/utils";

import { HistoryActionButton } from "./history-action-button";

interface HistorySectionHeaderProps {
  title: string;
  clearLabel: string;
  clearTooltip: string;
  groupClass: string;
  className?: string;
  onClear: () => void;
}

export function HistorySectionHeader({
  title,
  clearLabel,
  clearTooltip,
  groupClass,
  className,
  onClear,
}: HistorySectionHeaderProps) {
  return (
    <div className={cn("relative flex items-center gap-2 px-3 py-1.5", groupClass, className)}>
      <p className="min-w-0 flex-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>

      <div
        className={cn(
          "opacity-0 transition-opacity focus-within:opacity-100",
          groupClass === "group/queries" ? "group-hover/queries:opacity-100" : "group-hover/videos:opacity-100",
        )}
      >
        <HistoryActionButton
          label={clearLabel}
          tooltip={clearTooltip}
          side="bottom"
          className={cn(
            "shrink-0 text-muted-foreground",
            "hover:bg-destructive/15 hover:text-destructive",
            "focus-visible:ring-destructive/30",
          )}
          onClick={onClear}
        >
          <Trash2 className="size-3.5" />
        </HistoryActionButton>
      </div>
    </div>
  );
}
