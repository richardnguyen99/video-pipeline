import { Skeleton } from "@/components/ui/skeleton";
import { ACTRESSES_PAGE_SIZE } from "@/libs/actresses";

function ActressCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-col items-center gap-3 xs:flex-row xs:items-stretch xs:gap-3">
        <Skeleton className="size-[min(7.5rem,36vw)] shrink-0 rounded-full xs:size-30" />
        <div className="min-w-0 flex-1 space-y-2 self-center xs:self-stretch xs:py-0.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/60 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-10" />
        ))}
      </div>
    </div>
  );
}

export function ActressesGridSkeleton() {
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: ACTRESSES_PAGE_SIZE }).map((_, i) => (
          <li key={i} className="h-full min-w-0">
            <ActressCardSkeleton />
          </li>
        ))}
      </ul>
      <div className="mt-10 flex items-center justify-center gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </>
  );
}

/** Full-page shell used only as route pendingComponent before loader resolves. */
export function ActressesIndexSkeleton() {
  return (
    <div className="min-h-screen pt-16">
      <div className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-16">
        <header className="mb-8">
          <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">Actresses</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Browse performers and their featured titles.
          </p>
        </header>
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg sm:h-8 sm:w-28" />
          ))}
        </div>
        <ActressesGridSkeleton />
      </div>
    </div>
  );
}
