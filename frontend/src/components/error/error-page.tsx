import { useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/libs/api-client";
import { getApiErrorMessage } from "@/libs/auth";

function resolveErrorCopy(error: Error): {
  code: string;
  title: string;
  description: string;
} {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return {
        code: "Offline",
        title: "Connection problem",
        description: "We could not reach the server. Check your network connection and try again.",
      };
    }

    if (error.status >= 500) {
      return {
        code: String(error.status),
        title: "Something went wrong",
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
      description: "We could not reach the server. Check your network connection and try again.",
    };
  }

  return {
    code: "Error",
    title: "Something went wrong",
    description: message.length > 0 ? message : "An unexpected error occurred. You can try again or return home.",
  };
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();
  const { code, title, description } = resolveErrorCopy(error);

  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{code}</p>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>

      <p className="max-w-md text-sm text-muted-foreground">{description}</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </Button>

        <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
