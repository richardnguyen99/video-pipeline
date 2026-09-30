import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/libs/utils";

export interface VideoActionButtonProps extends Omit<ComponentProps<typeof Button>, "title"> {
  tooltip: string;
  children: ReactNode;
}

export const videoActionBtnClass =
  "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent py-1.5 px-3 h-auto gap-1.5";

export function VideoActionButton({
  tooltip,
  className,
  children,
  variant = "secondary",
  ...props
}: VideoActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant={variant} className={cn(className)} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
