import { cn } from "@/libs/utils";

export const DEBOUNCE_MS = 280;
export const MIN_QUERY_LENGTH = 2;

export const HISTORY_TOOLTIP_CLASS = cn(
  "z-[200] rounded-full border border-primary/25 bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-md",
);

export const PANEL_CLASS =
  "absolute top-[calc(100%+0.35rem)] right-0 left-0 z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg";
