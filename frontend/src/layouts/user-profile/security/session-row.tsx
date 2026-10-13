import { MonitorSmartphone } from "lucide-react";

import type { AuthSessionItem } from "@/queries/auth-sessions";

type SessionRowProps = {
  session: AuthSessionItem;
};

function formatLastLoggedIn(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SessionRow({ session }: SessionRowProps) {
  const location = session.location?.trim() || null;
  const ip = session.ip_address?.trim() || null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <MonitorSmartphone className="size-4" aria-hidden />
        </span>

        <div className="min-w-0">
          <p className="text-sm font-medium">{session.browser_label}</p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {[ip, location].filter(Boolean).join(" · ") || "Unknown location"}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Last signed in {formatLastLoggedIn(session.last_logged_in)}
          </p>
        </div>
      </div>

      {session.is_current ? (
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">Current</span>
      ) : null}
    </div>
  );
}
