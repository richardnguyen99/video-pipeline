import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { SettingsNav } from "@/layouts/user-profile/settings-nav";
import type { SettingsNavKey } from "@/layouts/user-profile/settings-nav";

type SettingsShellProps = {
  username: string;
  active: SettingsNavKey;
  isOwner: boolean;
  children: ReactNode;
};

export function SettingsShell({ username, active, isOwner, children }: SettingsShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pt-24 pb-16">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <SettingsNav username={username} active={active} isOwner={isOwner} />

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}

type SettingsContentHeaderProps = {
  active: SettingsNavKey;
  title: string;
  description: string;
};

export function SettingsContentHeader({ active, title, description }: SettingsContentHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{active.replaceAll("-", " ")}</p>

      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>

      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function SettingsContentSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />

        <Skeleton className="h-7 w-48" />

        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <Skeleton className="h-40 w-full rounded-xl" />

      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

/**
 * Two-column chrome while the session is still resolving.
 * Keeps the left sidebar slot mounted so auth settle does not collapse the layout.
 */
export function SettingsShellPending() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pt-24 pb-16"
      aria-busy="true"
      aria-label="Loading account"
    >
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-28" />

        <Skeleton className="h-9 w-40" />

        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <aside className="flex w-full flex-col gap-6 lg:w-56 lg:shrink-0">
          <div className="flex flex-col gap-1">
            <Skeleton className="mx-3 h-3 w-16" />

            <div className="flex flex-col gap-1">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Skeleton className="mx-3 h-3 w-20" />

            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <SettingsContentSkeleton />
        </section>
      </div>
    </div>
  );
}

type SettingsCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function SettingsCard({ title, description, action, children, className }: SettingsCardProps) {
  return (
    <div className={`rounded-xl border border-border/60 bg-card/40 p-5 ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>

          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}
