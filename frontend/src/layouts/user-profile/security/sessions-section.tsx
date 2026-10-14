import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionRow } from "@/layouts/user-profile/security/session-row";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import { ApiError } from "@/libs/api-client";
import { HttpStatus } from "@/libs/http-status";
import { applyAuthSession, notifyAuthSessionEnded } from "@/libs/auth-session";
import { authSessionQueryKeys, authSessionsQueryOptions, revokeAllAuthSessions } from "@/queries/auth-sessions";

export function SessionsSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery(authSessionsQueryOptions);

  const revokeAll = useMutation({
    mutationFn: revokeAllAuthSessions,
    onSuccess: async () => {
      await queryClient.removeQueries({ queryKey: authSessionQueryKeys.all });
      applyAuthSession(queryClient, null);
      notifyAuthSessionEnded();
      await navigate({ to: "/sign-in" });
    },
  });

  const isAuthError =
    query.isError &&
    query.error instanceof ApiError &&
    (query.error.status === HttpStatus.UNAUTHORIZED || query.error.status === HttpStatus.FORBIDDEN);
  const items = isAuthError ? [] : (query.data?.items ?? []);
  const isLoading = query.isPending;
  const errorMessage = query.isError && !isAuthError ? getApiErrorMessage(query.error) : null;

  return (
    <SettingsCard
      title="Sessions"
      description="Review where your Velvet account is currently signed in."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || items.length === 0 || revokeAll.isPending}
          onClick={() => {
            void revokeAll.mutateAsync();
          }}
        >
          {revokeAll.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Signing out…
            </>
          ) : (
            "Sign out all"
          )}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-lg" />

          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      {!isLoading && errorMessage != null ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {!isLoading && errorMessage == null && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : null}

      {!isLoading && errorMessage == null && items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {items.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      ) : null}

      {revokeAll.isError ? (
        <p className="mt-2 text-sm text-destructive">{getApiErrorMessage(revokeAll.error)}</p>
      ) : null}
    </SettingsCard>
  );
}
