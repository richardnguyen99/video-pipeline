import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, ColumnFiltersState, SortingState } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileUp,
  Image as ImageIcon,
  KeyRound,
  Pencil,
  RefreshCw,
  ScrollText,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/libs/utils";
import { listVideoUploadActivity, videoUploadActivityQueryKey } from "@/queries/video-upload";
import type { VideoUploadActivityItem } from "@/queries/video-upload";

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const CATEGORY_ALL = "all";

const EVENT_LABELS: Record<string, string> = {
  upload_created: "Video upload",
  upload_completed: "Video upload",
  stream_encoding_started: "Stream created",
  stream_ready: "Stream created",
  stream_rebuilt: "Rebuild stream",
  rendition_recovered: "Rebuild stream",
  metadata_updated: "Metadata edit",
  access_updated: "Access edit",
  thumbnail_uploaded: "Media upload",
  thumbnail_linked: "Media upload",
  thumbnail_deleted: "Media upload",
  sample_uploaded: "Media upload",
  sample_linked: "Media upload",
  sample_deleted: "Media upload",
};

const CATEGORY_FILTER_OPTIONS = [
  { value: CATEGORY_ALL, label: "All" },
  { value: "Video upload", label: "Video upload" },
  { value: "Stream created", label: "Stream created" },
  { value: "Rebuild stream", label: "Rebuild stream" },
  { value: "Media upload", label: "Media upload" },
  { value: "Metadata edit", label: "Metadata edit" },
  { value: "Access edit", label: "Access edit" },
] as const;

function eventIcon(eventType: string) {
  switch (eventType) {
    case "upload_created":
    case "upload_completed":
      return FileUp;
    case "stream_encoding_started":
    case "stream_ready":
      return Video;
    case "stream_rebuilt":
    case "rendition_recovered":
      return RefreshCw;
    case "metadata_updated":
      return Pencil;
    case "access_updated":
      return KeyRound;
    case "thumbnail_uploaded":
    case "thumbnail_linked":
    case "thumbnail_deleted":
    case "sample_uploaded":
    case "sample_linked":
    case "sample_deleted":
      return ImageIcon;
    default:
      return ScrollText;
  }
}

function eventCategory(eventType: string): string {
  return EVENT_LABELS[eventType] ?? "Activity";
}

function formatWhen(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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

const columns: Array<ColumnDef<typeof features, VideoUploadActivityItem>> = [
  {
    id: "category",
    accessorFn: (row) => eventCategory(row.event_type),
    header: "Activity",
    enableSorting: false,
    filterFn: (row, _columnId, filterValue: string) => {
      if (filterValue === CATEGORY_ALL || filterValue.length === 0) {
        return true;
      }

      return eventCategory(row.original.event_type) === filterValue;
    },
    cell: ({ row }) => {
      const item = row.original;
      const Icon = eventIcon(item.event_type);
      const category = eventCategory(item.event_type);

      return (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
            <Icon className="size-3.5" aria-hidden />
          </span>

          <span className="truncate text-sm font-medium">{category}</span>
        </div>
      );
    },
  },
  {
    id: "detail",
    accessorKey: "message",
    header: "Detail",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-muted-foreground block max-w-full truncate text-sm" title={row.original.message}>
        {row.original.message}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 justify-start gap-1 px-2"
        onClick={() => {
          column.toggleSorting(column.getIsSorted() === "asc");
        }}
      >
        When
        <SortIcon sorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground block truncate text-xs tabular-nums" title={row.original.created_at}>
        {formatWhen(row.original.created_at)}
      </span>
    ),
    sortFn: (a, b) => {
      const left = new Date(a.original.created_at).getTime();
      const right = new Date(b.original.created_at).getTime();

      return left - right;
    },
  },
];

type UploadLogsProps = {
  uploadId: string;
};

export function UploadLogs({ uploadId }: UploadLogsProps) {
  const query = useQuery({
    queryKey: videoUploadActivityQueryKey(uploadId),
    queryFn: () => listVideoUploadActivity(uploadId),
    staleTime: 10_000,
  });

  const data = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL);

  const presentCategories = useMemo(() => {
    const values = new Set(data.map((item) => eventCategory(item.event_type)));

    return CATEGORY_FILTER_OPTIONS.filter((option) => option.value === CATEGORY_ALL || values.has(option.value));
  }, [data]);

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  const setCategory = (value: string) => {
    setCategoryFilter(value);
    setColumnFilters(value === CATEGORY_ALL ? [] : [{ id: "category", value }]);
  };

  if (query.isLoading) {
    return <UploadLogsSkeleton />;
  }

  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:px-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Activity log</h1>

          <p className="text-muted-foreground mt-1 text-sm">
            Read-only history of upload, stream, media, and catalog actions for this entry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by activity">
          {presentCategories.map((option) => {
            const active = categoryFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setCategory(option.value);
                }}
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm">
          <ScrollText className="size-8 opacity-40" aria-hidden />
          <p>No activity recorded for this upload yet.</p>
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="text-muted-foreground px-5 py-10 text-center text-sm">No activities match this filter.</div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.id === "category" && "w-44",
                      header.column.id === "created_at" && "w-44",
                    )}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="h-11">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

export function UploadLogsSkeleton() {
  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-busy="true" aria-label="Loading activity log">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:px-6">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`tag-${String(index)}`} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-44">Activity</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead className="w-44">When</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {Array.from({ length: 8 }).map((_, index) => (
            <TableRow key={`log-skeleton-${String(index)}`} className="h-11">
              <TableCell className="py-1.5">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableCell>

              <TableCell className="py-1.5">
                <Skeleton className="h-4 w-[min(100%,24rem)]" />
              </TableCell>

              <TableCell className="py-1.5">
                <Skeleton className="h-3 w-32" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
