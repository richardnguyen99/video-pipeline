import { useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/libs/api-client";
import { getApiErrorMessage } from "@/libs/auth";

function resolveStudioError(error: Error): {
  code: string;
  title: string;
  description: string;
} {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return {
        code: "Offline",
        title: "Connection problem",
        description: "Studio could not reach the server. Check your network connection and try again.",
      };
    }

    if (error.status === 401) {
      return {
        code: "401",
        title: "Sign in required",
        description: "Your session expired or is missing. Sign in again to open studio.",
      };
    }

    if (error.status === 403) {
      return {
        code: "403",
        title: "Access denied",
        description: "You do not have permission to view this studio resource.",
      };
    }

    if (error.status === 404) {
      return {
        code: "404",
        title: "Not found",
        description: "This studio page or upload could not be found.",
      };
    }

    if (error.status >= 500) {
      return {
        code: String(error.status),
        title: "Studio is unavailable",
        description: getApiErrorMessage(error),
      };
    }

    return {
      code: String(error.status),
      title: "Request failed",
      description: getApiErrorMessage(error),
    };
  }

  const message = error.message.trim();

  if (message === "Request failed with status 0") {
    return {
      code: "Offline",
      title: "Connection problem",
      description: "Studio could not reach the server. Check your network connection and try again.",
    };
  }

  return {
    code: "Error",
    title: "Something went wrong in studio",
    description: message.length > 0 ? message : "An unexpected error occurred while loading this studio page.",
  };
}

export function StudioErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();
  const { code, title, description } = resolveStudioError(error);

  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{code}</p>

        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

        <p className="text-muted-foreground mx-auto max-w-md text-sm">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          <RotateCcw data-icon="inline-start" className="size-4" />
          Try again
        </Button>

        <Button type="button" variant="outline" nativeButton={false} render={<Link to="/studio" />}>
          <ArrowLeft data-icon="inline-start" className="size-4" />
          Studio overview
        </Button>

        <Button type="button" variant="ghost" nativeButton={false} render={<Link to="/studio/uploads" />}>
          Uploads
        </Button>
      </div>
    </div>
  );
}

export function StudioNotFoundPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">404</p>

      <h1 className="text-2xl font-semibold tracking-tight">Studio page not found</h1>

      <p className="text-muted-foreground mx-auto max-w-md text-sm">
        This studio route does not exist or the upload is no longer available.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" nativeButton={false} render={<Link to="/studio" />}>
          Studio overview
        </Button>

        <Button type="button" variant="outline" nativeButton={false} render={<Link to="/studio/uploads" />}>
          Uploads
        </Button>
      </div>
    </div>
  );
}
