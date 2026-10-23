import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CloudUpload, FileVideo, Loader2, X } from "lucide-react";

import {
  actressMultiFilterConfig,
  directorMultiFilterConfig,
  genreMultiFilterConfig,
  labelMultiFilterConfig,
  makerMultiFilterConfig,
  seriesMultiFilterConfig,
} from "@/components/entity-multi-filter/configs";
import { EntityMultiFilter } from "@/components/entity-multi-filter/index";
import type { EntityMultiFilterConfig } from "@/components/entity-multi-filter/index";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, ensureFreshAccessToken } from "@/libs/api-client";
import { getApiErrorMessage } from "@/libs/auth";
import { HttpStatus } from "@/libs/http-status";
import { cn } from "@/libs/utils";
import { ProcessTrace } from "@/components/video/studio/process-trace";
import {
  completeVideoUpload,
  createVideoUpload,
  DEFAULT_PART_SIZE_BYTES,
  MAX_PARALLEL_PARTS,
  mergeLiveProgress,
  parseVideoCodeConflict,
  presignVideoUploadParts,
  subscribeVideoUploadProgress,
} from "@/queries/video-upload";
import type { CompletedPart, ExistingVideoSummary, VideoUploadStatusResponse } from "@/queries/video-upload";

const RELATION_FILTERS = [
  { key: "actresses", label: "Actresses", config: actressMultiFilterConfig },
  { key: "makers", label: "Makers", config: makerMultiFilterConfig },
  { key: "genres", label: "Genres", config: genreMultiFilterConfig },
  { key: "series", label: "Series", config: seriesMultiFilterConfig },
  { key: "labels", label: "Labels", config: labelMultiFilterConfig },
  { key: "directors", label: "Directors", config: directorMultiFilterConfig },
] as const;

type RelationKey = (typeof RELATION_FILTERS)[number]["key"];

type RelationSelections = Record<RelationKey, Array<number>>;

const EMPTY_RELATIONS: RelationSelections = {
  actresses: [],
  makers: [],
  genres: [],
  series: [],
  labels: [],
  directors: [],
};

const STEPS = [
  { number: 1, label: "Select file" },
  { number: 2, label: "Details" },
  { number: 3, label: "Visibility" },
  { number: 4, label: "Upload" },
  { number: 5, label: "Process" },
  { number: 6, label: "Preview & publish" },
] as const;

const ALLOWED_EXTENSIONS = ["mp4", "mkv", "mov", "webm"] as const;

const VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can discover and watch this video.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Only people with the link can watch this video.",
  },
  {
    value: "private",
    label: "Private",
    description: "Only you can watch this video.",
  },
] as const;

type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];

const SESSION_KEEPALIVE_CHECK_MS = 60 * 1000;
const ACCESS_TOKEN_MIN_TTL_SECONDS = 120;

type UploadPhase = "idle" | "preparing" | "uploading" | "completing" | "done" | "error" | "conflict";

function etagFromResponse(response: Response): string {
  const raw = response.headers.get("etag") ?? response.headers.get("ETag");

  if (!raw) {
    throw new Error("Upload part response missing ETag header.");
  }

  return raw;
}

async function putPart(url: string, blob: Blob): Promise<string> {
  const response = await fetch(url, {
    method: "PUT",
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Part upload failed with status ${response.status}`);
  }

  return etagFromResponse(response);
}

async function mapPool<T, TResult>(
  items: Array<T>,
  concurrency: number,
  worker: (item: T) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results: Array<TResult> = new Array(items.length);
  let nextIndex = 0;

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);

  return results;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function stepTitle(step: number): string {
  switch (step) {
    case 1:
      return "Upload your video";
    case 2:
      return "Add the finishing touches";
    case 3:
      return "Choose who can watch";
    case 4:
      return "Upload your video";
    case 5:
      return "Process your video";
    case 6:
      return "Preview and publish";
    default:
      return "Studio";
  }
}

export function UploadStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadStartedRef = useRef(false);

  const [activeStep, setActiveStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoCode, setVideoCode] = useState("");
  const [cid, setCid] = useState("");
  const [jancode, setJancode] = useState("");
  const [makerProduct, setMakerProduct] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [relations, setRelations] = useState<RelationSelections>(EMPTY_RELATIONS);
  const [visibility, setVisibility] = useState<VisibilityValue>("unlisted");
  const [notifySubscribers, setNotifySubscribers] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [autoProcess, setAutoProcess] = useState(true);

  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progressPct, setProgressPct] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoUploadStatusResponse | null>(null);
  const [upsertDialogOpen, setUpsertDialogOpen] = useState(false);
  const [conflictExisting, setConflictExisting] = useState<ExistingVideoSummary | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      return;
    }

    const sourceUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    video.src = sourceUrl;

    const capture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setThumbnailUrl(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(sourceUrl);
    };

    const onLoaded = () => {
      video.currentTime = Math.min(1, video.duration || 1);
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", capture, { once: true });

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.remove();
      URL.revokeObjectURL(sourceUrl);
    };
  }, [file]);

  useEffect(() => {
    if (activeStep !== 5 || status?.public_id == null) {
      return;
    }

    const publicId = status.public_id;

    return subscribeVideoUploadProgress(
      publicId,
      (live) => {
        setStatus((previous) => {
          if (previous == null) {
            return previous;
          }

          return mergeLiveProgress(previous, live);
        });
      },
      (next) => {
        setStatus(next);
      },
    );
  }, [activeStep, status?.public_id]);

  const fileSizeLabel = useMemo(() => {
    if (!file) {
      return "";
    }

    return formatFileSize(file.size);
  }, [file]);

  const chooseFile = useCallback((selectedFile?: File) => {
    if (!selectedFile) {
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();

    if (!extension || !(ALLOWED_EXTENSIONS as ReadonlyArray<string>).includes(extension)) {
      setMessage("Unsupported format. Use MP4, MKV, MOV, or WEBM.");

      return;
    }

    setFile(selectedFile);
    setThumbnailUrl("");
    setTitle(selectedFile.name.replace(/\.[^.]+$/, ""));
    setMessage(null);
    setPhase("idle");
    setProgressPct(0);
    setStatus(null);
    uploadStartedRef.current = false;
    setActiveStep(2);
  }, []);

  const setRelationIds = useCallback((key: RelationKey, ids: Array<number>) => {
    setRelations((current) => ({
      ...current,
      [key]: ids,
    }));
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      chooseFile(list && list.length > 0 ? list[0] : undefined);
    },
    [chooseFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const list = event.dataTransfer.files;
      chooseFile(list.length > 0 ? list[0] : undefined);
    },
    [chooseFile],
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setTitle("");
    setDescription("");
    setVideoCode("");
    setCid("");
    setJancode("");
    setMakerProduct("");
    setReleaseDate("");
    setRelations(EMPTY_RELATIONS);
    setThumbnailUrl("");
    setPhase("idle");
    setProgressPct(0);
    setStatus(null);
    setMessage(null);
    uploadStartedRef.current = false;
    setActiveStep(1);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const runUpload = useCallback(
    async (allowUpsert = false) => {
      if (!file || uploadStartedRef.current) {
        return;
      }

      uploadStartedRef.current = true;
      setPhase("preparing");
      setProgressPct(0);
      setMessage(null);
      setStatus(null);
      setUpsertDialogOpen(false);

      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      try {
        const created = await createVideoUpload({
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
          video_code: videoCode.trim() || undefined,
          allow_upsert: allowUpsert || undefined,
          part_size_bytes: DEFAULT_PART_SIZE_BYTES,
        });

        setPhase("uploading");

        keepaliveTimer = setInterval(() => {
          void ensureFreshAccessToken(ACCESS_TOKEN_MIN_TTL_SECONDS);
        }, SESSION_KEEPALIVE_CHECK_MS);

        const partCount = created.part_count;
        const partSize = created.part_size_bytes;
        const partNumbers = Array.from({ length: partCount }, (_, index) => index + 1);

        const urlByPart = new Map<number, string>(created.parts.map((part) => [part.part_number, part.url]));

        const missing = partNumbers.filter((n) => !urlByPart.has(n));

        if (missing.length > 0) {
          const extra = await presignVideoUploadParts(created.public_id, created.multipart_upload_id, missing);

          for (const part of extra) {
            urlByPart.set(part.part_number, part.url);
          }
        }

        let finishedBytes = 0;
        const completed: Array<CompletedPart> = await mapPool(partNumbers, MAX_PARALLEL_PARTS, async (partNumber) => {
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const blob = file.slice(start, end);
          let url = urlByPart.get(partNumber);

          if (!url) {
            const [refreshed] = await presignVideoUploadParts(created.public_id, created.multipart_upload_id, [
              partNumber,
            ]);
            url = refreshed.url;
            urlByPart.set(partNumber, url);
          }

          const etag = await putPart(url, blob);
          finishedBytes += blob.size;
          setProgressPct(Math.min(99, Math.round((finishedBytes / file.size) * 100)));

          return { part_number: partNumber, etag };
        });

        setPhase("completing");
        setProgressPct(99);

        const accessToken = await ensureFreshAccessToken(ACCESS_TOKEN_MIN_TTL_SECONDS);

        if (accessToken === null) {
          throw new Error(
            "Session expired during upload. Sign in again, then retry. " +
              "Uploaded parts may still be in object storage until completed.",
          );
        }

        const orderedParts = completed.sort((a, b) => a.part_number - b.part_number);
        let finalStatus: VideoUploadStatusResponse;

        try {
          finalStatus = await completeVideoUpload(created.public_id, created.multipart_upload_id, orderedParts);
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== HttpStatus.UNAUTHORIZED) {
            throw error;
          }

          const retried = await ensureFreshAccessToken(0);

          if (retried === null) {
            throw new Error("Session expired while completing the upload. Sign in again and retry.", { cause: error });
          }

          finalStatus = await completeVideoUpload(created.public_id, created.multipart_upload_id, orderedParts);
        }

        setStatus(finalStatus);
        setPhase("done");
        setProgressPct(100);
        setMessage(`Uploaded. Status: ${finalStatus.status}`);

        if (autoProcess) {
          window.setTimeout(() => {
            setActiveStep(5);
          }, 450);
        }
      } catch (error) {
        const apiMessage = getApiErrorMessage(error);

        if (
          error instanceof ApiError &&
          error.status === HttpStatus.CONFLICT &&
          videoCode.trim().length > 0 &&
          !allowUpsert
        ) {
          // Structured body is only returned for admins by the API.
          const conflict = parseVideoCodeConflict(error);

          if (conflict != null) {
            uploadStartedRef.current = true;
            setPhase("conflict");
            setProgressPct(0);
            setMessage(conflict.message);
            setConflictMessage(conflict.message);
            setConflictExisting(conflict.existing);
            setUpsertDialogOpen(true);

            return;
          }
        }

        uploadStartedRef.current = false;
        setPhase("error");
        setMessage(apiMessage);
        setConflictMessage(null);
        setConflictExisting(null);
        setUpsertDialogOpen(false);
      } finally {
        if (keepaliveTimer != null) {
          clearInterval(keepaliveTimer);
        }
      }
    },
    [autoProcess, file, title, videoCode],
  );

  const loadExistingInfo = useCallback(() => {
    if (conflictExisting == null) {
      return;
    }

    const existing = conflictExisting;

    setTitle(existing.title ?? "");
    setVideoCode(existing.video_id);
    setCid(existing.cid ?? "");
    setJancode(existing.jancode ?? "");
    setMakerProduct(existing.maker_product ?? "");
    setReleaseDate(
      existing.release_date != null && existing.release_date.length >= 10 ? existing.release_date.slice(0, 10) : "",
    );
    setRelations({
      actresses: existing.actress_ids,
      makers: existing.maker_ids,
      genres: existing.genre_ids,
      series: existing.series_ids,
      labels: existing.label_ids,
      directors: existing.director_ids,
    });
    setUpsertDialogOpen(false);
    setConflictExisting(null);
    setMessage(
      `Loaded catalog fields for ${existing.video_id}` +
        (existing.status != null ? ` (status: ${existing.status})` : "") +
        ". Review details, then continue when ready to upload a new source.",
    );
    setPhase("idle");
    uploadStartedRef.current = false;
    setActiveStep(2);
  }, [conflictExisting]);

  useEffect(() => {
    if (activeStep === 4 && file && phase === "idle" && !uploadStartedRef.current && !upsertDialogOpen) {
      void runUpload();
    }
  }, [activeStep, file, phase, runUpload, upsertDialogOpen]);

  const canContinue = useMemo(() => {
    if (activeStep === 1) {
      return Boolean(file);
    }

    if (activeStep === 2) {
      return Boolean(title.trim());
    }

    if (activeStep === 4) {
      return phase === "done";
    }

    if (activeStep === 5) {
      if (status == null) {
        return false;
      }

      if (status.renditions.length === 0) {
        return status.status === "READY";
      }

      return status.renditions.every((row) => row.status.toUpperCase() === "READY");
    }

    return true;
  }, [activeStep, file, phase, status, title]);

  const busy = phase === "preparing" || phase === "uploading" || phase === "completing";

  const percentComplete = Math.round(((activeStep - 1) / (STEPS.length - 1)) * 100);

  const onDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const goNext = () => {
    if (activeStep === 6) {
      return;
    }

    setActiveStep((step) => Math.min(6, step + 1));
  };

  const goBack = () => {
    if (busy) {
      return;
    }

    setActiveStep((step) => Math.max(1, step - 1));
  };

  return (
    <main className="flex w-full flex-col gap-8 px-6 py-8 sm:px-10 lg:px-16 lg:py-32">
      <nav className="flex flex-wrap items-center gap-2 w-full" aria-label="Upload progress">
        {STEPS.map((step, _) => (
          <div key={step.number} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-xs font-medium",
                activeStep >= step.number
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {activeStep > step.number ? <Check className="size-3.5" /> : step.number}
            </div>

            <span
              className={cn(
                "text-sm whitespace-nowrap",
                activeStep >= step.number ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>

            <div
              className={cn("mx-1 hidden h-px grow sm:block", activeStep > step.number ? "bg-primary" : "bg-border")}
            />
          </div>
        ))}
      </nav>

      <section className="flex flex-col gap-6">
        <div className="bg-card flex flex-col gap-6 rounded-xl border p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Step {activeStep} of {STEPS.length}
              </span>

              <h2 className="text-xl font-semibold">{stepTitle(activeStep)}</h2>
            </div>

            <span className="text-muted-foreground text-sm tabular-nums">{percentComplete}%</span>
          </div>

          {activeStep === 1 ? (
            <div className="flex flex-col gap-4">
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30",
                )}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDragLeave={() => {
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                onClick={() => {
                  inputRef.current?.click();
                }}
                onKeyDown={onDropzoneKeyDown}
              >
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  accept=".mp4,.mkv,.mov,.webm,video/mp4,video/x-matroska,video/quicktime,video/webm"
                  onChange={handleFileChange}
                />

                <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                  <CloudUpload className="size-6" />
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-medium">
                    {isDragging ? "Drop your video here" : "Drag and drop your video here"}
                  </h3>

                  <p className="text-muted-foreground text-sm">
                    or <span className="text-primary font-medium">browse your files</span> from your computer
                  </p>
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="font-medium">Supported formats</span>

                  {ALLOWED_EXTENSIONS.map((extension) => (
                    <span key={extension} className="bg-muted rounded-md px-2 py-0.5 font-mono uppercase">
                      {extension}
                    </span>
                  ))}
                </div>
              </div>

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Generated video thumbnail"
                      className="size-14 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-muted flex size-14 items-center justify-center rounded-md">
                      <FileVideo className="size-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>

                    <p className="text-muted-foreground text-xs">{fileSizeLabel} · Ready to upload</p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove selected video"
                    onClick={clearFile}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="studio-title">Video title</Label>

                  <Input
                    id="studio-title"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                    }}
                    placeholder="Give your video a clear, memorable title"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="studio-description">Description</Label>

                  <Textarea
                    id="studio-description"
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                    }}
                    placeholder="Tell viewers what this video is about"
                    rows={4}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="studio-video-code">Video code</Label>

                  <Input
                    id="studio-video-code"
                    value={videoCode}
                    onChange={(event) => {
                      setVideoCode(event.target.value);
                    }}
                    placeholder="Business / product code (video_id)"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="studio-cid">CID</Label>

                  <Input
                    id="studio-cid"
                    value={cid}
                    onChange={(event) => {
                      setCid(event.target.value);
                    }}
                    placeholder="Content ID"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="studio-jancode">JAN code</Label>

                  <Input
                    id="studio-jancode"
                    value={jancode}
                    onChange={(event) => {
                      setJancode(event.target.value);
                    }}
                    placeholder="Barcode / JAN"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="studio-maker-product">Maker product</Label>

                  <Input
                    id="studio-maker-product"
                    value={makerProduct}
                    onChange={(event) => {
                      setMakerProduct(event.target.value);
                    }}
                    placeholder="Maker product code"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="studio-release-date">Release date</Label>

                  <Input
                    id="studio-release-date"
                    type="date"
                    value={releaseDate}
                    onChange={(event) => {
                      setReleaseDate(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium">Catalog relations</h3>

                  <p className="text-muted-foreground text-xs">
                    Link actresses, makers, genres, series, labels, and directors. Relation IDs are kept for publish;
                    catalog write APIs are not connected in this skeleton.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {RELATION_FILTERS.map((section) => (
                    <div key={section.key} className="flex flex-col gap-2">
                      <Label>{section.label}</Label>

                      <EntityMultiFilter
                        selected={relations[section.key]}
                        onChange={(ids) => {
                          setRelationIds(section.key, ids);
                        }}
                        config={section.config as unknown as EntityMultiFilterConfig}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={notifySubscribers}
                  onCheckedChange={(checked) => {
                    setNotifySubscribers(checked === true);
                  }}
                />

                <span>Notify your subscribers when this video goes live</span>
              </label>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="flex flex-col gap-3">
              {VISIBILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                    visibility === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                  )}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={visibility === option.value}
                    className="mt-1"
                    onChange={() => {
                      setVisibility(option.value);
                    }}
                  />

                  <span className="flex flex-col gap-0.5">
                    <strong className="text-sm font-medium">{option.label}</strong>

                    <small className="text-muted-foreground text-xs">{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="flex w-full flex-col gap-4 py-2">
              <div className="flex items-start gap-4">
                <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
                  {busy ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : phase === "done" ? (
                    <Check className="size-5 text-emerald-500" />
                  ) : phase === "error" || phase === "conflict" ? (
                    <X className="size-5 text-destructive" />
                  ) : (
                    <CloudUpload className="size-5" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="text-base font-medium">
                    {phase === "done"
                      ? "Upload complete"
                      : phase === "error"
                        ? "Upload failed"
                        : phase === "conflict"
                          ? "Video code already exists"
                          : "Uploading your video"}
                  </h3>

                  <p
                    className={cn(
                      "text-sm",
                      phase === "error" || phase === "conflict"
                        ? "text-destructive"
                        : phase === "done"
                          ? "text-emerald-500"
                          : "text-muted-foreground",
                    )}
                  >
                    {phase === "error" || phase === "conflict"
                      ? (message ?? "Something went wrong.")
                      : phase === "done"
                        ? (message ?? "Your video finished uploading.")
                        : "Your video is being uploaded directly to object storage."}
                  </p>
                </div>
              </div>

              <div className="flex w-full items-center gap-3 rounded-lg border p-3 text-left">
                <FileVideo className="size-4 shrink-0" />

                <span className="min-w-0 flex-1 truncate text-sm">{file?.name ?? "Selected video"}</span>

                <strong className="text-sm tabular-nums">{progressPct}%</strong>
              </div>

              <Progress value={progressPct} className="h-2 w-full" />

              <label className="flex w-full items-start gap-2 text-left text-sm">
                <Checkbox
                  checked={autoProcess}
                  disabled={busy}
                  onCheckedChange={(checked) => {
                    setAutoProcess(checked === true);
                  }}
                />

                <span>Automatically continue to processing when upload completes</span>
              </label>

              {phase === "conflict" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => {
                    setUpsertDialogOpen(true);
                  }}
                >
                  Resolve conflict
                </Button>
              ) : null}

              {phase === "error" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => {
                    uploadStartedRef.current = false;
                    setPhase("idle");
                    setMessage(null);
                    void runUpload();
                  }}
                >
                  Retry upload
                </Button>
              ) : null}
            </div>
          ) : null}

          {activeStep === 5 ? (
            <div className="flex w-full flex-col gap-4 py-2">
              <div className="flex items-start gap-4">
                <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
                  {status?.status === "FAILED" ? (
                    <X className="size-5 text-destructive" />
                  ) : status != null &&
                    status.renditions.length > 0 &&
                    status.renditions.every((row) => row.status.toUpperCase() === "READY") ? (
                    <Check className="size-5 text-emerald-500" />
                  ) : (
                    <Loader2 className="size-5 animate-spin" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="text-base font-medium">Processing your video</h3>

                  <p className="text-muted-foreground text-sm">
                    {status?.status === "FAILED"
                      ? (status.error_message ?? "Encoding failed.")
                      : status != null &&
                          status.renditions.length > 0 &&
                          status.renditions.every((row) => row.status.toUpperCase() === "READY")
                        ? "All resolutions encoded. Continue to preview."
                        : "Encoding each resolution into HLS streams. Lower rungs finish first so playback can start early."}
                  </p>
                </div>
              </div>

              <ProcessTrace status={status} />
            </div>
          ) : null}

          {activeStep === 6 ? (
            <div className="flex w-full flex-col gap-4 py-2">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-6" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="text-base font-medium">Preview and publish</h3>

                  <p className="text-muted-foreground text-sm">
                    Review title, visibility, and file before sharing. Publish is a no-op until the catalog API is
                    connected.
                  </p>
                </div>
              </div>

              <dl className="bg-muted/40 grid w-full gap-3 rounded-lg border p-4 text-left text-sm sm:grid-cols-2">
                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <dt className="text-muted-foreground text-xs">File</dt>

                  <dd className="font-medium break-all">{file?.name ?? "Selected video"}</dd>
                </div>

                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <dt className="text-muted-foreground text-xs">Title</dt>

                  <dd className="font-medium">{title.trim() || "Untitled video"}</dd>
                </div>

                {videoCode.trim() ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Video code</dt>

                    <dd className="font-medium">{videoCode.trim()}</dd>
                  </div>
                ) : null}

                {cid.trim() ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">CID</dt>

                    <dd className="font-medium">{cid.trim()}</dd>
                  </div>
                ) : null}

                {jancode.trim() ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">JAN code</dt>

                    <dd className="font-medium">{jancode.trim()}</dd>
                  </div>
                ) : null}

                {makerProduct.trim() ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Maker product</dt>

                    <dd className="font-medium">{makerProduct.trim()}</dd>
                  </div>
                ) : null}

                {releaseDate ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Release date</dt>

                    <dd className="font-medium">{releaseDate}</dd>
                  </div>
                ) : null}

                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs">Visibility</dt>

                  <dd className="font-medium capitalize">{visibility}</dd>
                </div>

                {status ? (
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">Upload status</dt>

                    <dd className="font-medium">
                      {status.status}

                      {status.public_id ? (
                        <span className="text-muted-foreground mt-0.5 block font-mono text-xs">{status.public_id}</span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}

                {description.trim() ? (
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">Description</dt>

                    <dd className="text-muted-foreground whitespace-pre-wrap">{description}</dd>
                  </div>
                ) : null}

                {RELATION_FILTERS.map((section) => {
                  const ids = relations[section.key];

                  if (ids.length === 0) {
                    return null;
                  }

                  return (
                    <div key={section.key} className="flex flex-col gap-0.5">
                      <dt className="text-muted-foreground text-xs">{section.label}</dt>

                      <dd className="font-medium tabular-nums">{ids.length} selected</dd>
                    </div>
                  );
                })}

                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs">Notify subscribers</dt>

                  <dd className="font-medium">{notifySubscribers ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {message && (activeStep !== 4 || phase === "idle" || phase === "error" || phase === "conflict") ? (
            <p
              className={cn(
                "text-sm",
                phase === "error" || phase === "conflict" ? "text-destructive" : "text-emerald-500",
              )}
              role={phase === "error" || phase === "conflict" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            {activeStep > 1 ? (
              <Button type="button" variant="outline" disabled={busy} onClick={goBack}>
                <ArrowLeft data-icon="inline-start" className="size-4" />
                Back
              </Button>
            ) : (
              <span />
            )}

            <Button
              type="button"
              disabled={!canContinue || (activeStep === 6 && phase !== "done")}
              onClick={() => {
                if (activeStep === 6) {
                  return;
                }

                goNext();
              }}
            >
              {activeStep === 6 ? "Publish video" : activeStep === 5 ? "Preview video" : "Continue"}
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
          </div>
        </div>

        <aside className="bg-card rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Library</span>

              <h3 className="text-sm font-semibold">Session summary</h3>
            </div>

            <FileVideo className="text-muted-foreground size-4" />
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Selected file</dt>

              <dd className="truncate font-medium">{file?.name ?? "None"}</dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Size</dt>

              <dd className="font-medium">{fileSizeLabel || "—"}</dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Video code</dt>

              <dd className="truncate font-medium">{videoCode.trim() || "—"}</dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Visibility</dt>

              <dd className="font-medium capitalize">{visibility}</dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Relations</dt>

              <dd className="font-medium">
                {Object.values(relations).reduce((sum, ids) => sum + ids.length, 0)} linked
              </dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Upload</dt>

              <dd className="font-medium">
                {phase === "idle" && "Not started"}
                {phase === "preparing" && "Preparing…"}
                {phase === "uploading" && `Uploading ${progressPct}%`}
                {phase === "completing" && "Finalizing…"}
                {phase === "done" && "Complete"}
                {phase === "error" && "Failed"}
                {phase === "conflict" && "Code in use"}
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      <Dialog
        open={upsertDialogOpen && phase === "conflict"}
        onOpenChange={(open) => {
          setUpsertDialogOpen(open);

          if (!open && phase === "conflict") {
            uploadStartedRef.current = true;
          }
        }}
      >
        <DialogContent className="max-w-md gap-0">
          <div className="flex flex-col gap-3 px-5 py-4">
            <DialogTitle className="text-lg font-semibold">Video code already exists</DialogTitle>

            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              {conflictMessage ?? "This video code is already in use."}
            </DialogDescription>

            {conflictExisting != null ? (
              <dl className="bg-muted/40 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-left text-xs">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Record id</dt>

                  <dd className="font-medium tabular-nums">{conflictExisting.id}</dd>
                </div>

                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Status</dt>

                  <dd className="font-medium">{conflictExisting.status ?? "—"}</dd>
                </div>

                <div className="col-span-2 flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Title</dt>

                  <dd className="font-medium">{conflictExisting.title ?? "—"}</dd>
                </div>

                {conflictExisting.cid != null && conflictExisting.cid.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">CID</dt>

                    <dd className="font-medium">{conflictExisting.cid}</dd>
                  </div>
                ) : null}

                {conflictExisting.jancode != null && conflictExisting.jancode.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">JAN</dt>

                    <dd className="font-medium">{conflictExisting.jancode}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>

          <DialogFooter className="border-border flex flex-col gap-3 border-t px-5 py-4 sm:flex-col">
            <p className="text-muted-foreground text-xs">
              Load fills the form without uploading. Update replaces the source file.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUpsertDialogOpen(false);
                  setPhase("conflict");
                  uploadStartedRef.current = true;
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={conflictExisting == null}
                onClick={() => {
                  loadExistingInfo();
                }}
              >
                Load existing info
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  uploadStartedRef.current = false;
                  void runUpload(true);
                }}
              >
                Update existing
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
