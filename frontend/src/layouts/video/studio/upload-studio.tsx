import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConflictDialog } from "@/layouts/video/studio/conflict-dialog";
import { SessionSummary } from "@/layouts/video/studio/session-summary";
import { DetailsStep } from "@/layouts/video/studio/steps/details-step";
import { PreviewStep } from "@/layouts/video/studio/steps/preview-step";
import { ProcessStep } from "@/layouts/video/studio/steps/process-step";
import { SelectFileStep } from "@/layouts/video/studio/steps/select-file-step";
import { UploadStep } from "@/layouts/video/studio/steps/upload-step";
import { VisibilityStep } from "@/layouts/video/studio/steps/visibility-step";
import { ALLOWED_EXTENSIONS, EMPTY_RELATIONS, STEPS } from "@/layouts/video/studio/types";
import type { RelationKey, RelationSelections, UploadPhase, VisibilityValue } from "@/layouts/video/studio/types";
import {
  ACCESS_TOKEN_MIN_TTL_SECONDS,
  formatFileSize,
  mapPool,
  putPart,
  SESSION_KEEPALIVE_CHECK_MS,
  stepPercentComplete,
  stepTitle,
} from "@/layouts/video/studio/upload-helpers";
import { ApiError, ensureFreshAccessToken } from "@/libs/api-client";
import { getApiErrorMessage } from "@/libs/auth";
import { HttpStatus } from "@/libs/http-status";
import { cn } from "@/libs/utils";
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

export function UploadStudio() {
  const navigate = useNavigate();
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
    video.preload = "metadata";
    video.muted = true;
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
  const percentComplete = stepPercentComplete(activeStep);

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
      <nav className="flex w-full flex-wrap items-center gap-2" aria-label="Upload progress">
        {STEPS.map((step) => (
          <div key={step.number} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                activeStep === step.number
                  ? "bg-primary text-primary-foreground"
                  : activeStep > step.number
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {activeStep > step.number ? <Check className="size-4" /> : step.number}
            </div>

            <span
              className={cn(
                "hidden text-xs sm:inline",
                activeStep === step.number ? "font-medium" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>

            {step.number < STEPS.length ? <div className="bg-border mx-1 hidden h-px flex-1 sm:block" /> : null}
          </div>
        ))}
      </nav>

      <section className="flex w-full flex-col gap-6">
        <div className="bg-card flex w-full flex-col gap-6 rounded-xl border p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Step {activeStep} of {STEPS.length}
                </span>

                <h2 className="text-xl font-semibold tracking-tight">{stepTitle(activeStep)}</h2>
              </div>

              <span className="text-muted-foreground text-sm tabular-nums">{percentComplete}%</span>
            </div>

            <Progress value={percentComplete} className="h-1.5 w-full" />
          </div>

          {activeStep === 1 ? (
            <SelectFileStep
              file={file}
              fileSizeLabel={fileSizeLabel}
              thumbnailUrl={thumbnailUrl}
              isDragging={isDragging}
              inputRef={inputRef}
              onDragEnter={() => {
                setIsDragging(true);
              }}
              onDragLeave={() => {
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              onFileChange={handleFileChange}
              onClearFile={clearFile}
              onDropzoneKeyDown={onDropzoneKeyDown}
            />
          ) : null}

          {activeStep === 2 ? (
            <DetailsStep
              title={title}
              description={description}
              videoCode={videoCode}
              cid={cid}
              jancode={jancode}
              makerProduct={makerProduct}
              releaseDate={releaseDate}
              relations={relations}
              notifySubscribers={notifySubscribers}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onVideoCodeChange={setVideoCode}
              onCidChange={setCid}
              onJancodeChange={setJancode}
              onMakerProductChange={setMakerProduct}
              onReleaseDateChange={setReleaseDate}
              onRelationIdsChange={setRelationIds}
              onNotifySubscribersChange={setNotifySubscribers}
            />
          ) : null}

          {activeStep === 3 ? <VisibilityStep visibility={visibility} onVisibilityChange={setVisibility} /> : null}

          {activeStep === 4 ? (
            <UploadStep
              fileName={file?.name ?? null}
              phase={phase}
              progressPct={progressPct}
              message={message}
              autoProcess={autoProcess}
              busy={busy}
              onAutoProcessChange={setAutoProcess}
              onResolveConflict={() => {
                setUpsertDialogOpen(true);
              }}
              onRetry={() => {
                uploadStartedRef.current = false;
                setPhase("idle");
                setMessage(null);
                void runUpload();
              }}
            />
          ) : null}

          {activeStep === 5 ? <ProcessStep status={status} /> : null}

          {activeStep === 6 ? (
            <PreviewStep
              model={{
                fileName: file?.name ?? null,
                title,
                description,
                videoCode,
                cid,
                jancode,
                makerProduct,
                releaseDate,
                visibility,
                notifySubscribers,
                relations,
                status,
              }}
            />
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
              disabled={!canContinue || (activeStep === 6 && (status == null || phase === "error"))}
              onClick={() => {
                if (activeStep === 6) {
                  if (status == null) {
                    return;
                  }

                  void navigate({
                    to: "/videos/$id",
                    params: { id: String(status.id) },
                  });

                  return;
                }

                goNext();
              }}
            >
              {activeStep === 6 ? "Open video page" : activeStep === 5 ? "Preview video" : "Continue"}
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
          </div>
        </div>

        <SessionSummary
          fileName={file?.name ?? null}
          fileSizeLabel={fileSizeLabel}
          videoCode={videoCode}
          visibility={visibility}
          relations={relations}
          phase={phase}
          progressPct={progressPct}
        />
      </section>

      <ConflictDialog
        open={upsertDialogOpen && phase === "conflict"}
        message={conflictMessage}
        existing={conflictExisting}
        onOpenChange={(open) => {
          setUpsertDialogOpen(open);

          if (!open && phase === "conflict") {
            uploadStartedRef.current = true;
          }
        }}
        onLoadExisting={loadExistingInfo}
        onOverwrite={() => {
          uploadStartedRef.current = false;
          void runUpload(true);
        }}
        onCancel={() => {
          setUpsertDialogOpen(false);
          setPhase("conflict");
          uploadStartedRef.current = true;
        }}
      />
    </main>
  );
}
