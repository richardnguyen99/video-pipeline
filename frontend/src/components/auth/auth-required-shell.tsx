import { Link, useRouterState } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AuthRequiredShell() {
  const href = useRouterState({ select: (state) => state.location.href });

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">401</p>

      <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>

      <p className="text-muted-foreground max-w-md text-sm">
        You need an active session to open this page. Sign in and you will be returned here.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" nativeButton={false} render={<Link to="/sign-in" search={{ redirect: href }} />}>
          <LogIn data-icon="inline-start" className="size-4" />
          Sign in
        </Button>

        <Button type="button" variant="outline" nativeButton={false} render={<Link to="/" />}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
