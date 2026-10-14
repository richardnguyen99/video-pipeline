import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { HistoryRow } from "@/layouts/user-profile/security/history-row";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import { ApiError } from "@/libs/api-client";
import { HttpStatus } from "@/libs/http-status";
import { authActivityQueryOptions } from "@/queries/auth-activity";

export function HistorySection() {
  const query = useQuery(authActivityQueryOptions(50, 0));

  const isAuthError =
    query.isError &&
    query.error instanceof ApiError &&
    (query.error.status === HttpStatus.UNAUTHORIZED || query.error.status === HttpStatus.FORBIDDEN);
  const items = isAuthError ? [] : (query.data?.items ?? []);
  const isLoading = query.isPending;
  const errorMessage = query.isError && !isAuthError ? getApiErrorMessage(query.error) : null;

  return (
    <SettingsCard
      title="History"
      description="Recent sign-ins, credential changes, and content actions on this account."
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-lg" />

          <Skeleton className="h-16 w-full rounded-lg" />

          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      {!isLoading && errorMessage != null ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {!isLoading && errorMessage == null && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : null}

      {!isLoading && errorMessage == null && items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <HistoryRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </SettingsCard>
  );
}
