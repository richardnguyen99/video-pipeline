import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Clock,
  Ellipsis,
  ExternalLink,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { defaultStepForStatus } from "@/layouts/video/studio/session-persist";
import { formatFileSize } from "@/layouts/video/studio/upload-helpers";
import { getApiErrorMessage } from "@/libs/auth";
import { cn } from "@/libs/utils";
import {
  deleteVideoUpload,
  listVideoUploadMedia,
  rebuildVideoUploadStream,
  VIDEO_UPLOADS_LIST_QUERY_KEY,
  videoUploadStatusQueryKey,
  videoUploadStatusQueryOptions,
} from "@/queries/video-upload";
import type { VideoRenditionProgress, VideoUploadStatusResponse } from "@/queries/video-upload";

const PROCESSING_STATUSES = new Set(["QUEUED", "ENCODING", "PROCESSING", "PENDING", "TRANSCODING"]);

const UPLOADING_STATUSES = new Set(["PENDING", "UPLOADING", "ASSEMBLING"]);

function statusTone(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (key === "FAILED") {
    return "text-destructive";
  }

  if (UPLOADING_STATUSES.has(key)) {
    return "text-muted-foreground";
  }

  return "text-amber-700 dark:text-amber-400";
}

function statusDotTone(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "bg-emerald-500";
  }

  if (key === "FAILED") {
    return "bg-destructive";
  }

  if (UPLOADING_STATUSES.has(key)) {
    return "bg-muted-foreground";
  }

  return "bg-amber-500";
}

function statusLabel(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "Ready";
  }

  if (key === "FAILED") {
    return "Failed";
  }

  if (UPLOADING_STATUSES.has(key)) {
    return "Uploading";
  }

  if (PROCESSING_STATUSES.has(key)) {
    return "Processing";
  }

  return status;
}

function renditionStatusLabel(status: string): string {
  const key = status.toUpperCase();

  if (key === "READY") {
    return "Ready";
  }

  if (key === "FAILED") {
    return "Failed";
  }

  if (key === "ENCODING" || key === "PROCESSING") {
    return "Encoding";
  }

  if (key === "QUEUED" || key === "PENDING") {
    return "Queued";
  }

  return status;
}

function displayTitle(status: VideoUploadStatusResponse): string {
  return status.title?.trim() || status.original_filename?.trim() || "Untitled upload";
}

function videoPagePath(videoNumericId: number): string {
  return `/videos/${String(videoNumericId)}`;
}

function videoPageHref(videoNumericId: number): string {
  if (typeof window === "undefined") {
    return videoPagePath(videoNumericId);
  }

  return `${window.location.origin}${videoPagePath(videoNumericId)}`;
}

function RenditionRow({ row }: { row: VideoRenditionProgress }) {
  const key = row.status.toUpperCase();
  const isReady = key === "READY";
  const isFailed = key === "FAILED";
  const isQueued = key === "QUEUED" || key === "PENDING";
  const isEncoding = !isReady && !isFailed && !isQueued;

  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            isReady && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            isFailed && "bg-destructive/15 text-destructive",
            isQueued && "bg-muted text-muted-foreground",
            isEncoding && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
          )}
        >
          {isReady ? (
            <Check className="size-3.5" />
          ) : isFailed ? (
            <X className="size-3.5" />
          ) : isQueued ? (
            <Clock className="size-3.5" />
          ) : (
            <Loader2 className="size-3.5 animate-spin" />
          )}
        </span>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{row.label}</span>

          <span className="text-muted-foreground text-xs">
            {row.width}×{row.height}
            {row.video_kbps > 0 ? ` · ${String(row.video_kbps)} kbps` : ""}
            {row.segment_count != null ? ` · ${String(row.segment_count)} segments` : ""}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:min-w-48">
        <div className="min-w-0 flex-1">
          <Progress value={Math.min(100, Math.max(0, row.progress_pct))} />
        </div>

        <span className={cn("text-xs font-medium tabular-nums", statusTone(row.status))}>
          {renditionStatusLabel(row.status)}
          {isEncoding ? ` ${Math.round(row.progress_pct)}%` : ""}
        </span>
      </div>
    </div>
  );
}

type UploadOverviewProps = {
  uploadId: string;
  initialStatus?: VideoUploadStatusResponse | null;
};

export function UploadOverview({ uploadId, initialStatus = null }: UploadOverviewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionBusy, setActionBusy] = useState<"rebuild" | "delete" | null>(null);

  const statusQuery = useQuery({
    ...videoUploadStatusQueryOptions(uploadId),
    initialData: initialStatus ?? undefined,
    queryKey: videoUploadStatusQueryKey(uploadId),
    refetchInterval: (current) => {
      const data = current.state.data;
      const nextStatus = data?.status.toUpperCase() ?? "";

      if (nextStatus === "FAILED") {
        return false;
      }

      if (nextStatus === "READY") {
        const rungs = data?.renditions ?? [];
        const allReady = rungs.length > 0 && rungs.every((row) => row.status.toUpperCase() === "READY");

        return allReady ? false : 2_000;
      }

      return 2_000;
    },
  });

  const mediaQuery = useQuery({
    queryKey: ["video-upload-media", uploadId],
    queryFn: () => listVideoUploadMedia(uploadId),
    enabled: statusQuery.data != null,
    staleTime: 10_000,
  });

  const status = statusQuery.data ?? initialStatus;
  const media = mediaQuery.data;

  const thumbnailUrl = useMemo(() => {
    const thumbs = media?.thumbnails ?? [];
    const ready = thumbs.find((item) => {
      const itemStatus = (item.status ?? "READY").toUpperCase();

      return itemStatus === "READY" && item.url.length > 0 && !item.url.startsWith("pending://");
    });

    return ready?.url ?? thumbs.find((item) => item.url.length > 0)?.url ?? null;
  }, [media?.thumbnails]);

  const thumbnailCount = media?.thumbnails.length ?? 0;
  const sampleCount = media?.samples.length ?? 0;

  const handleRebuildStream = useCallback(async () => {
    if (actionBusy != null) {
      return;
    }

    setActionBusy("rebuild");

    try {
      const next = await rebuildVideoUploadStream(uploadId);
      queryClient.setQueryData(videoUploadStatusQueryKey(uploadId), next);
      await queryClient.invalidateQueries({
        queryKey: VIDEO_UPLOADS_LIST_QUERY_KEY,
        refetchType: "active",
      });
      void statusQuery.refetch();
      toast.add({
        type: "success",
        title: "Stream rebuild started",
        description: "All resolutions were reset and encoding was re-queued.",
        timeout: 4000,
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "Could not rebuild stream",
        description: getApiErrorMessage(error),
        timeout: 4000,
      });
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, queryClient, statusQuery, uploadId]);

  const handleDeleteVideo = useCallback(async () => {
    if (actionBusy != null) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this upload and video permanently? Stream files, thumbnails, and samples will be removed.",
    );

    if (!confirmed) {
      return;
    }

    setActionBusy("delete");

    try {
      await deleteVideoUpload(uploadId);
      void queryClient.removeQueries({ queryKey: videoUploadStatusQueryKey(uploadId) });
      void queryClient.invalidateQueries({ queryKey: VIDEO_UPLOADS_LIST_QUERY_KEY });
      toast.add({
        type: "success",
        title: "Upload deleted",
        description: "The video and associated objects were removed.",
        timeout: 4000,
      });
      void navigate({ to: "/studio/uploads" });
    } catch (error) {
      toast.add({
        type: "error",
        title: "Could not delete upload",
        description: getApiErrorMessage(error),
        timeout: 4000,
      });
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, navigate, queryClient, uploadId]);

  if (statusQuery.isLoading && status == null) {
    return <UploadOverviewSkeleton />;
  }

  if (status == null) {
    return (
      <section className="bg-card flex flex-col gap-3 rounded-xl border p-6">
        <h1 className="text-lg font-semibold">Upload not found</h1>

        <p className="text-muted-foreground text-sm">
          This upload could not be loaded. It may have been removed or you may not have access.
        </p>

        <Button
          type="button"
          variant="outline"
          className="w-fit"
          nativeButton={false}
          render={<Link to="/studio/uploads" />}
        >
          Back to uploads
        </Button>
      </section>
    );
  }

  const mediaPending = mediaQuery.isLoading && media == null;

  const title = displayTitle(status);
  const continueStep = defaultStepForStatus(status);
  const pageHref = videoPageHref(status.id);
  const pagePath = videoPagePath(status.id);
  const sizeLabel = status.source_bytes != null ? formatFileSize(status.source_bytes) : "—";

  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-col gap-0 lg:flex-row">
        <div className="bg-muted relative aspect-video w-full shrink-0 overflow-hidden lg:w-[min(100%,22rem)] lg:self-stretch">
          {mediaPending ? (
            <Skeleton className="absolute inset-0 size-full rounded-none" />
          ) : thumbnailUrl != null ? (
            <img src={thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2">
              <FileVideo className="size-10 opacity-50" />
              <span className="text-xs">No thumbnail yet</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <dl className="grid min-w-0 flex-1 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Video</dt>

                <dd className="truncate text-base font-semibold">
                  {status.video_id} — {title}
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Video page</dt>

                <dd className="flex min-w-0 items-center gap-2">
                  <a
                    href={pagePath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate text-sm font-medium hover:underline"
                  >
                    {pageHref}
                  </a>

                  <ExternalLink className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Status</dt>

                <dd className="flex items-center gap-2 text-sm font-medium">
                  <span className={cn("size-2 shrink-0 rounded-full", statusDotTone(status.status))} aria-hidden />

                  <span className={statusTone(status.status)}>{statusLabel(status.status)}</span>

                  {status.ready_at != null ? (
                    <span className="text-muted-foreground font-normal">
                      · {new Date(status.ready_at).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">
                      · updated {new Date(status.updated_at).toLocaleString()}
                    </span>
                  )}
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Upload metadata</dt>

                <dd className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-foreground font-medium">{sizeLabel}</span>

                  <span className="bg-border hidden h-3 w-px sm:inline" aria-hidden />

                  {mediaPending ? (
                    <>
                      <Skeleton className="h-4 w-24" />
                      <span className="bg-border hidden h-3 w-px sm:inline" aria-hidden />
                      <Skeleton className="h-4 w-20" />
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <ImageIcon className="size-3.5 shrink-0" aria-hidden />
                        {thumbnailCount} thumbnail{thumbnailCount === 1 ? "" : "s"}
                      </span>

                      <span className="bg-border hidden h-3 w-px sm:inline" aria-hidden />

                      <span>
                        {sampleCount} sample{sampleCount === 1 ? "" : "s"}
                      </span>
                    </>
                  )}

                  {status.original_filename != null && status.original_filename.length > 0 ? (
                    <>
                      <span className="bg-border hidden h-3 w-px sm:inline" aria-hidden />
                      <span className="truncate">{status.original_filename}</span>
                    </>
                  ) : null}
                </dd>
              </div>
            </dl>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {status.status.toUpperCase() !== "READY" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link
                      to="/studio/uploads/$uploadId/$step"
                      params={{
                        uploadId: status.public_id,
                        step: continueStep,
                      }}
                    />
                  }
                >
                  Continue process
                </Button>
              ) : null}

              <Button
                type="button"
                size="sm"
                nativeButton={false}
                render={<a href={pagePath} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink data-icon="inline-start" className="size-4" />
                Open video
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  disabled={actionBusy != null}
                  className={cn(
                    "border-input bg-background hover:bg-muted inline-flex size-8 items-center justify-center rounded-md border shadow-xs transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                  aria-label="More actions"
                >
                  {actionBusy != null ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Ellipsis className="size-4" aria-hidden />
                  )}
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={actionBusy != null}
                      onClick={() => {
                        void handleRebuildStream();
                      }}
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      Rebuild stream
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => {
                        void navigate({
                          to: "/studio/uploads/$uploadId/$step",
                          params: {
                            uploadId: status.public_id,
                            step: 3,
                          },
                        });
                      }}
                    >
                      <Shield className="size-4" aria-hidden />
                      Manage access
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={actionBusy != null}
                      onClick={() => {
                        void handleDeleteVideo();
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete video
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <Collapsible defaultOpen className="group/resolutions border-t">
        <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-medium sm:px-6">
          <span>Stream resolutions</span>

          <span className="text-muted-foreground flex items-center gap-2 text-xs font-normal">
            {status.renditions.length > 0
              ? `${String(
                  status.renditions.filter((row) => row.status.toUpperCase() === "READY").length,
                )} / ${String(status.renditions.length)} ready`
              : "No encodings yet"}
            <ChevronDown className="size-4 transition-transform group-data-panel-open/resolutions:rotate-180" />
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {status.renditions.length === 0 ? (
            <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
              Encoding has not produced resolution rungs for this upload yet.
            </p>
          ) : (
            <div className="border-t">
              {status.renditions.map((row) => (
                <RenditionRow key={`${row.label}-${String(row.height)}`} row={row} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

export function UploadOverviewSkeleton() {
  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-busy="true" aria-label="Loading upload summary">
      <div className="flex flex-col gap-0 lg:flex-row">
        <Skeleton className="aspect-video w-full shrink-0 rounded-none lg:w-[min(100%,22rem)] lg:self-stretch" />

        <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <dl className="grid min-w-0 flex-1 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-72 max-w-full" />
              </div>

              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>

              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-52 max-w-full" />
              </div>

              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-28" />
                <div className="flex flex-wrap items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40 max-w-full" />
                </div>
              </div>
            </dl>

            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t">
        <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
        </div>

        <div className="border-t">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`rendition-skeleton-${String(index)}`}
              className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />

                <div className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>

              <div className="flex items-center gap-3 sm:min-w-48">
                <Skeleton className="h-2 min-w-0 flex-1 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
