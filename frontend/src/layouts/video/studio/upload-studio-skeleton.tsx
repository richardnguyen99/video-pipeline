import { STEPS } from "@/layouts/video/studio/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/libs/utils";

type UploadStudioSkeletonProps = {
  activeStep?: number;
};

export function UploadStudioSkeleton({ activeStep = 1 }: UploadStudioSkeletonProps) {
  const current = Math.min(7, Math.max(1, activeStep));

  return (
    <main className="flex w-full flex-col gap-8">
      <nav
        className="bg-background/95 border-border sticky top-0 z-20 flex w-full flex-wrap items-center gap-2 border-b py-3 backdrop-blur"
        aria-label="Upload progress"
        aria-busy="true"
      >
        {STEPS.map((step) => {
          const isCurrent = current === step.number;
          const isComplete = step.number < current;

          return (
            <div key={step.number} className="flex flex-1 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.number}
                </span>

                <span
                  className={cn(
                    "hidden truncate text-xs sm:inline",
                    isCurrent ? "font-medium" : isComplete ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {step.number < STEPS.length ? <div className="bg-border mx-1 hidden h-px flex-1 sm:block" /> : null}
            </div>
          );
        })}
      </nav>

      <section className="flex w-full flex-col gap-6">
        <div className="bg-card flex w-full flex-col gap-6 rounded-xl border p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-56" />
          </div>

          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-1/3" />
          </div>
        </div>

        <div className="bg-card flex w-full flex-col gap-4 rounded-xl border p-5 sm:p-6">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
