import type { LucideIcon } from "lucide-react";

import { cn, formatCompactNumber } from "@/libs/utils";

interface ActressStatProps {
  icon: LucideIcon;
  value: number;
  label: string;
  className?: string;
}

export function ActressStat({ icon: Icon, value, label, className }: ActressStatProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-1.5 text-sm text-white/90 lg:gap-2 lg:text-base", className)}
      title={label}
    >
      <Icon className="size-4 shrink-0 opacity-90 lg:size-5" aria-hidden />
      <span className="sr-only">{label}</span>
      <span className="font-medium tabular-nums">{formatCompactNumber(value)}</span>
    </div>
  );
}
