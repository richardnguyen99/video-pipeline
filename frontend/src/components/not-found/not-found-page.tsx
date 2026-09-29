import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">404</p>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>

      <p className="max-w-md text-sm text-muted-foreground">
        The page you requested does not exist or may have been moved.
      </p>

      <Button nativeButton={false} render={<Link to="/" />}>
        Back to home
      </Button>
    </div>
  );
}
