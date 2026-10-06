export function BioFallback() {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />

        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />

        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />

        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
