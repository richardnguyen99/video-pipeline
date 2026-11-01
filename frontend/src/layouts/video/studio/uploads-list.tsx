import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, FileVideo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFileSize } from "@/layouts/video/studio/upload-helpers";
import { cn } from "@/libs/utils";
import { listVideoUploads, VIDEO_UPLOADS_LIST_QUERY_KEY } from "@/queries/video-upload";
import type { VideoUploadListItem } from "@/queries/video-upload";

const PAGE_SIZE = 10;

const STATUS_FILTER_ALL = "all";
const STATUS_FILTER_PROCESSING = "processing";
const STATUS_FILTER_DONE = "done";
const STATUS_FILTER_FAILED = "failed";

const STATUS_FILTER_OPTIONS = [
  { value: STATUS_FILTER_ALL, label: "All statuses" },
  { value: STATUS_FILTER_PROCESSING, label: "Processing" },
  { value: STATUS_FILTER_DONE, label: "Done" },
  { value: STATUS_FILTER_FAILED, label: "Error" },
] as const;

const PROCESSING_STATUSES = new Set(["UPLOADED", "PROBING", "QUEUED", "ENCODING", "PACKAGING"]);

const UPLOADING_STATUSES = new Set(["PENDING", "UPLOADING"]);

function statusFilterGroup(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return STATUS_FILTER_DONE;
  }

  if (key === "FAILED") {
    return STATUS_FILTER_FAILED;
  }

  if (PROCESSING_STATUSES.has(key) || UPLOADING_STATUSES.has(key)) {
    return STATUS_FILTER_PROCESSING;
  }

  return STATUS_FILTER_PROCESSING;
}

function statusFilterLabel(value: string): string {
  const match = STATUS_FILTER_OPTIONS.find((option) => option.value === value);

  return match?.label ?? "Status";
}

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

function statusTone(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  }

  if (key === "FAILED") {
    return "bg-destructive/15 text-destructive";
  }

  if (key === "PENDING" || key === "UPLOADING") {
    return "bg-muted text-muted-foreground";
  }

  return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
}

function statusLabel(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "Done";
  }

  if (key === "FAILED") {
    return "Error";
  }

  if (UPLOADING_STATUSES.has(key)) {
    return "Uploading";
  }

  if (PROCESSING_STATUSES.has(key)) {
    return "Processing";
  }

  return status;
}

function displayTitle(item: VideoUploadListItem): string {
  return item.title?.trim() || item.original_filename?.trim() || "Untitled upload";
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ArrowUp className="size-3.5 shrink-0" aria-hidden />;
  }

  if (sorted === "desc") {
    return <ArrowDown className="size-3.5 shrink-0" aria-hidden />;
  }

  return <ArrowUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />;
}

const columns: Array<ColumnDef<typeof features, VideoUploadListItem>> = [
  {
    id: "video",
    accessorFn: (row) => `${row.title ?? ""} ${row.original_filename ?? ""} ${row.video_id}`,
    header: "Video",
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original;

      return (
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
            <FileVideo className="size-4" />
          </span>

          <div className="flex min-w-0 flex-col gap-0.5">
            <strong className="truncate text-sm font-medium">{displayTitle(item)}</strong>

            <span className="text-muted-foreground truncate text-xs">
              {item.video_id}
              {item.source_bytes != null ? ` · ${formatFileSize(item.source_bytes)}` : ""}
              {item.error_message != null && item.error_message !== "" ? ` · ${item.error_message}` : ""}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <span
        className={cn(
          "inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium",
          statusTone(row.original.status),
        )}
      >
        {statusLabel(row.original.status)}
      </span>
    ),
    filterFn: (row, _columnId, filterValue: string) => {
      if (filterValue === STATUS_FILTER_ALL || filterValue.length === 0) {
        return true;
      }

      return statusFilterGroup(row.original.status) === filterValue;
    },
  },
  {
    accessorKey: "updated_at",
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 min-w-[5.75rem] justify-start gap-1 px-2"
        onClick={() => {
          column.toggleSorting(column.getIsSorted() === "asc");
        }}
      >
        Updated
        <SortIcon sorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{formatUpdatedAt(row.original.updated_at)}</span>
    ),
    sortFn: (a, b) => {
      const left = new Date(a.original.updated_at).getTime();
      const right = new Date(b.original.updated_at).getTime();

      return left - right;
    },
  },
  {
    id: "size",
    accessorFn: (row) => row.source_bytes ?? -1,
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 min-w-[4.25rem] justify-start gap-1 px-2"
        onClick={() => {
          column.toggleSorting(column.getIsSorted() === "asc");
        }}
      >
        Size
        <SortIcon sorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.original.source_bytes != null ? formatFileSize(row.original.source_bytes) : "—"}
      </span>
    ),
  },
  {
    accessorKey: "overall_progress_pct",
    header: "Progress",
    enableSorting: false,
    cell: ({ row }) => {
      const pct = Math.min(100, Math.max(0, row.original.overall_progress_pct));

      return (
        <div className="flex min-w-20 flex-col gap-1">
          <Progress value={pct} />

          <span className="text-muted-foreground text-[10px]">{Math.round(pct)}%</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Action</span>,
    enableSorting: false,
    meta: {
      className: "w-12 text-right",
      size: 48,
    },
    cell: ({ row }) => {
      const item = row.original;

      if (!item.stream_ready) {
        return (
          <div className="flex justify-end">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Stream not ready"
              disabled
              className="opacity-40"
            >
              <ExternalLink className="size-4" />
            </Button>
          </div>
        );
      }

      return (
        <div className="flex justify-end">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Open ${displayTitle(item)}`}
            nativeButton={false}
            render={<Link to="/videos/$id" params={{ id: String(item.id) }} target="_blank" rel="noreferrer" />}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <ExternalLink className="size-4" />
          </Button>
        </div>
      );
    },
  },
];

function hasActiveProcessing(items: Array<VideoUploadListItem>): boolean {
  return items.some((item) => PROCESSING_STATUSES.has(item.status.toUpperCase()));
}

function UploadsListBodySkeleton() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <TableRow key={index}>
          <TableCell>
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-md" />

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-[min(100%,18rem)]" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </TableCell>

          <TableCell>
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>

          <TableCell>
            <Skeleton className="h-3 w-28" />
          </TableCell>

          <TableCell>
            <Skeleton className="h-3 w-14" />
          </TableCell>

          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-10" />
            </div>
          </TableCell>

          <TableCell className="text-right">
            <Skeleton className="ml-auto size-8 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

type UploadsListProps = {
  initialQuery?: string;
};

export function UploadsList({ initialQuery = "" }: UploadsListProps) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: VIDEO_UPLOADS_LIST_QUERY_KEY,
    queryFn: () => listVideoUploads({ limit: 100, offset: 0 }),
    staleTime: 5_000,
    refetchInterval: (current) => {
      const items = current.state.data?.items ?? [];

      return hasActiveProcessing(items) ? 2_000 : false;
    },
  });

  const data = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTER_ALL);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [syncedQuery, setSyncedQuery] = useState(initialQuery);

  if (syncedQuery !== initialQuery) {
    setSyncedQuery(initialQuery);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: initialQuery,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.trim().toLowerCase();

      if (q.length === 0) {
        return true;
      }

      const item = row.original;
      const title = (item.title ?? "").toLowerCase();
      const videoId = item.video_id.toLowerCase();

      return title.includes(q) || videoId.includes(q);
    },
  });

  const pageIndex = table.state.pagination.pageIndex;
  const pageCount = Math.max(1, table.getPageCount());
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Your uploads</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (value == null) {
              return;
            }

            setStatusFilter(value);
            table.getColumn("status")?.setFilterValue(value);
            table.setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-40" size="sm">
            <SelectValue placeholder="Status">{statusFilterLabel(statusFilter)}</SelectValue>
          </SelectTrigger>

          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isError ? <p className="text-destructive text-sm">Could not load your uploads.</p> : null}

      {!query.isError ? (
        <>
          <Table
            className="w-full table-fixed"
            aria-busy={query.isLoading ? true : undefined}
            aria-label={query.isLoading ? "Loading uploads" : undefined}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.id === "video" && "w-auto",
                        header.column.id === "status" && "w-24",
                        header.column.id === "updated_at" && "w-36",
                        header.column.id === "size" && "w-24",
                        header.column.id === "overall_progress_pct" && "w-28",
                        header.column.id === "actions" && "w-12 text-right",
                      )}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {query.isLoading ? (
                <UploadsListBodySkeleton />
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => {
                  const item = row.original;
                  const canResume = item.resumable;

                  return (
                    <TableRow
                      key={row.id}
                      className={cn(canResume && "hover:bg-muted/40 cursor-pointer")}
                      onClick={() => {
                        if (!canResume) {
                          return;
                        }

                        const statusKey = item.status.toUpperCase();
                        const step = statusKey === "READY" ? 7 : 5;

                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }

                        const main = document.querySelector<HTMLElement>("[data-studio-main]");

                        if (main != null) {
                          main.scrollTop = 0;
                        }

                        void navigate({
                          to: "/studio/uploads/$uploadId/$step",
                          params: {
                            uploadId: item.public_id,
                            step,
                          },
                        });
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn(cell.column.id === "actions" && "text-right")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground h-16 text-center">
                    No uploads match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {query.isLoading ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-3 w-40" />

              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-xs">
                {filteredCount === 0
                  ? "0 results"
                  : `Showing ${String(pageIndex * PAGE_SIZE + 1)}–${String(
                      Math.min((pageIndex + 1) * PAGE_SIZE, filteredCount),
                    )} of ${String(filteredCount)}`}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => {
                    table.previousPage();
                  }}
                >
                  Previous
                </Button>

                <span className="text-muted-foreground text-xs tabular-nums">
                  {String(pageIndex + 1)} / {String(pageCount)}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!table.getCanNextPage()}
                  onClick={() => {
                    table.nextPage();
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
