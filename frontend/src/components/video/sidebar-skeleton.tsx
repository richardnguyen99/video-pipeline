import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function SidebarSkeleton({ key, ...rest }: React.ComponentPropsWithRef<"div">) {
  return (
    <div key={key} className="flex gap-3" {...rest}>
      <Skeleton className="aspect-video w-40 shrink-0 rounded-lg sm:w-44" />

      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <Skeleton className="h-4 w-full" />

        <Skeleton className="h-4 w-3/4" />

        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
