import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFileSize } from "@/layouts/video/studio/upload-helpers";
import { cn } from "@/libs/utils";
import { listVideoUploads } from "@/queries/video-upload";
import type { VideoUploadListItem } from "@/queries/video-upload";

const PAGE_SIZE = 10;

const STATUS_FILTER_ALL = "all";

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

  if (key === "PENDING" || key === "UPLOADING") {
    return "Uploading";
  }

  if (key === "UPLOADED" || key === "PROBING" || key === "QUEUED" || key === "ENCODING") {
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
    return <ArrowUp className="size-3.5" />;
  }

  if (sorted === "desc") {
    return <ArrowDown className="size-3.5" />;
  }

  return <ArrowUpDown className="size-3.5 opacity-50" />;
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

      return row.original.status.toUpperCase() === filterValue.toUpperCase();
    },
  },
  {
    accessorKey: "updated_at",
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 gap-1 px-2"
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
        className="-ml-2 h-8 gap-1 px-2"
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
    cell: ({ row }) => {
      const item = row.original;

      if (!item.resumable) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }

      return (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Resume ${displayTitle(item)}`}
          nativeButton={false}
          render={<Link to="/studio/upload" search={{ publicId: item.public_id }} />}
        >
          <ExternalLink className="size-4" />
        </Button>
      );
    },
  },
];

export function UploadsList() {
  const query = useQuery({
    queryKey: ["video-uploads", "list"],
    queryFn: () => listVideoUploads({ limit: 100, offset: 0 }),
    staleTime: 15_000,
  });

  const data = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTER_ALL);

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: {
        pageSize: PAGE_SIZE,
        pageIndex: 0,
      },
    },
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.trim().toLowerCase();

      if (q.length === 0) {
        return true;
      }

      const item = row.original;
      const title = (item.title ?? "").toLowerCase();
      const filename = (item.original_filename ?? "").toLowerCase();
      const videoId = item.video_id.toLowerCase();

      return title.includes(q) || filename.includes(q) || videoId.includes(q);
    },
  });

  const statusOptions = useMemo(() => {
    const seen = new Set<string>();

    for (const item of data) {
      seen.add(item.status.toUpperCase());
    }

    return Array.from(seen).sort();
  }, [data]);

  const pageIndex = table.state.pagination.pageIndex;
  const pageCount = Math.max(1, table.getPageCount());
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Your uploads</span>

        <h2 className="text-lg font-semibold">Resume a session</h2>

        <p className="text-muted-foreground text-sm">
          Only uploads that finished the raw file transfer can be resumed in the wizard.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={globalFilter}
          onChange={(event) => {
            setGlobalFilter(event.target.value);
            table.setPageIndex(0);
          }}
          placeholder="Search by title or video id…"
          className="max-w-sm"
          aria-label="Search uploads"
        />

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
            <SelectValue placeholder="Status" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={STATUS_FILTER_ALL}>All statuses</SelectItem>

            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? <p className="text-muted-foreground text-sm">Loading uploads…</p> : null}

      {query.isError ? <p className="text-destructive text-sm">Could not load your uploads.</p> : null}

      {!query.isLoading && !query.isError ? (
        <>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground h-16 text-center">
                    No uploads match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

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
        </>
      ) : null}
    </section>
  );
}
