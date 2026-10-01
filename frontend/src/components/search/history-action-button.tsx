import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/libs/utils";

import { HISTORY_TOOLTIP_CLASS } from "./constants";

interface HistoryActionButtonProps {
  label: string;
  tooltip: string;
  side?: "left" | "bottom";
  className?: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function HistoryActionButton({
  label,
  tooltip,
  side = "left",
  className,
  pressed,
  onClick,
  children,
}: HistoryActionButtonProps) {
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            aria-pressed={pressed}
            className={cn("size-7 p-1.5 active:translate-y-0", className)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClick();
            }}
          />
        }
      >
        {children}
      </TooltipTrigger>

      <TooltipContent side={side} sideOffset={6} className={HISTORY_TOOLTIP_CLASS}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
