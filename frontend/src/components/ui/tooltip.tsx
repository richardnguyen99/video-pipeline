import { useEffect, useState } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/libs/utils";

function TooltipProvider({ delay = 200, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  children,
  container,
  ...props
}: TooltipPrimitive.Popup.Props & {
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  /** Override portal mount node. Defaults to fullscreen element when active. */
  container?: HTMLElement | null;
}) {
  const [fullscreenContainer, setFullscreenContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function syncFullscreenContainer() {
      const el = document.fullscreenElement;
      setFullscreenContainer(el instanceof HTMLElement ? el : null);
    }
    syncFullscreenContainer();
    document.addEventListener("fullscreenchange", syncFullscreenContainer);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenContainer);
  }, []);

  const portalContainer = container ?? fullscreenContainer ?? undefined;

  return (
    <TooltipPrimitive.Portal container={portalContainer}>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:scale-95 data-ending-style:scale-95 transition-all",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
