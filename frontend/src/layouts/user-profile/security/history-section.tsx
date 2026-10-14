import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { activityCopy, formatActivityCreatedAt } from "@/layouts/user-profile/security/history-row";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import { ApiError } from "@/libs/api-client";
import { HttpStatus } from "@/libs/http-status";
import { authActivityQueryOptions } from "@/queries/auth-activity";

const PAGE_SIZE = 10;

export function HistorySection() {
  const query = useQuery(authActivityQueryOptions(100, 0));
  const [page, setPage] = useState(1);

  const isAuthError =
    query.isError &&
    query.error instanceof ApiError &&
    (query.error.status === HttpStatus.UNAUTHORIZED || query.error.status === HttpStatus.FORBIDDEN);
  const items = isAuthError ? [] : (query.data?.items ?? []);
  const isLoading = query.isPending;
  const errorMessage = query.isError && !isAuthError ? getApiErrorMessage(query.error) : null;

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return items.slice(start, start + PAGE_SIZE);
  }, [items, currentPage]);

  return (
    <SettingsCard
      title="History"
      description="Recent sign-ins, credential changes, and content actions on this account."
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full rounded-lg" />

          <Skeleton className="h-10 w-full rounded-lg" />

          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : null}

      {!isLoading && errorMessage != null ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {!isLoading && errorMessage == null && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : null}

      {!isLoading && errorMessage == null && items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />

                <TableHead>Activity</TableHead>

                <TableHead className="hidden sm:table-cell">Details</TableHead>

                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageItems.map((item) => {
                const { title, detail, icon } = activityCopy(item);

                return (
                  <TableRow key={item.id}>
                    <TableCell className="w-10">
                      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {icon}
                      </span>
                    </TableCell>

                    <TableCell>
                      <p className="font-medium capitalize">{title}</p>

                      {detail != null ? (
                        <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{detail}</p>
                      ) : null}
                    </TableCell>

                    <TableCell className="hidden max-w-xs truncate text-muted-foreground sm:table-cell">
                      {detail ?? "—"}
                    </TableCell>

                    <TableCell className="text-right text-muted-foreground">
                      {formatActivityCreatedAt(item.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={currentPage <= 1}
                aria-label="Previous page"
                onClick={() => {
                  setPage((prev) => Math.max(1, prev - 1));
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>

              <p className="text-sm text-muted-foreground tabular-nums">
                {currentPage} / {totalPages}
              </p>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                onClick={() => {
                  setPage((prev) => Math.min(totalPages, prev + 1));
                }}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </SettingsCard>
  );
}
