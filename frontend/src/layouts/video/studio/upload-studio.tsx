import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConflictDialog } from "@/layouts/video/studio/conflict-dialog";
import {
  clearActiveUploadStudioPointer,
  defaultStepForStatus,
  loadUploadStudioSession,
  saveUploadStudioSession,
} from "@/layouts/video/studio/session-persist";
import { SessionSummary } from "@/layouts/video/studio/session-summary";
import { UploadsList } from "@/layouts/video/studio/uploads-list";
import { DetailsStep } from "@/layouts/video/studio/steps/details-step";
import { MediaStep } from "@/layouts/video/studio/steps/media-step";
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
  getVideoUploadStatus,
  MAX_PARALLEL_PARTS,
  mergeLiveProgress,
  parseVideoCodeConflict,
  presignVideoUploadParts,
  recoverVideoRendition,
  subscribeVideoUploadProgress,
  updateVideoUploadMetadata,
  VIDEO_UPLOADS_LIST_QUERY_KEY,
} from "@/queries/video-upload";
import type { CompletedPart, ExistingVideoSummary, VideoUploadStatusResponse } from "@/queries/video-upload";

const uploadRouteApi = getRouteApi("/_authenticated/studio/upload");

export function UploadStudio() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = uploadRouteApi.useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadStartedRef = useRef(false);
  const resumeAppliedRef = useRef<string | null>(null);
  const prevSearchPublicIdRef = useRef<string | undefined>(search.publicId);
  const [sessionFilename, setSessionFilename] = useState<string | null>(null);

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
  const [recoveringLabel, setRecoveringLabel] = useState<string | null>(null);
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

  useEffect(() => {
    const resumeId = search.publicId;

    if (resumeId == null || resumeAppliedRef.current === resumeId) {
      return;
    }

    let cancelled = false;

    const resume = async () => {
      try {
        const next = await getVideoUploadStatus(resumeId);

        if (cancelled) {
          return;
        }

        const draft = loadUploadStudioSession(resumeId);
        const preferredStep = search.step ?? draft?.activeStep ?? defaultStepForStatus(next);
        const clampedStep = Math.min(7, Math.max(5, preferredStep));

        resumeAppliedRef.current = resumeId;
        setStatus(next);
        setPhase("done");
        setProgressPct(100);
        uploadStartedRef.current = true;
        setActiveStep(clampedStep);
        setMessage(`Resumed upload ${next.status}`);

        if (draft != null) {
          setTitle(draft.title || next.title || "");
          setDescription(draft.description);
          setVideoCode(draft.videoCode);
          setCid(draft.cid || next.cid || "");
          setJancode(draft.jancode || next.jancode || "");
          setMakerProduct(draft.makerProduct || next.maker_product || "");
          setReleaseDate(
            draft.releaseDate ||
              (next.release_date != null && next.release_date.length >= 10 ? next.release_date.slice(0, 10) : ""),
          );
          setVisibility(draft.visibility);
          setNotifySubscribers(draft.notifySubscribers);
          setRelations(draft.relations);
          setSessionFilename(draft.originalFilename ?? next.original_filename);
        } else {
          setTitle(next.title ?? "");
          setCid(next.cid ?? "");
          setJancode(next.jancode ?? "");
          setMakerProduct(next.maker_product ?? "");
          setReleaseDate(
            next.release_date != null && next.release_date.length >= 10 ? next.release_date.slice(0, 10) : "",
          );
          setRelations({
            actresses: next.actress_ids,
            makers: next.maker_ids,
            genres: next.genre_ids,
            series: next.series_ids,
            labels: next.label_ids,
            directors: next.director_ids,
          });
          setSessionFilename(next.original_filename);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(getApiErrorMessage(error));
          setPhase("error");
        }
      }
    };

    void resume();

    return () => {
      cancelled = true;
    };
  }, [search.publicId, search.step]);

  useEffect(() => {
    if (search.publicId == null) {
      return;
    }

    const main = document.querySelector<HTMLElement>("[data-studio-main]");

    if (main == null) {
      return;
    }

    main.scrollTo({ top: 0, behavior: "smooth" });
  }, [search.publicId]);

  useEffect(() => {
    const publicId = status?.public_id;

    if (publicId == null) {
      return;
    }

    saveUploadStudioSession({
      publicId,
      activeStep,
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
      originalFilename: file?.name ?? sessionFilename ?? status?.original_filename ?? null,
      videoRowId: status?.id ?? null,
    });
  }, [
    activeStep,
    cid,
    description,
    file?.name,
    jancode,
    makerProduct,
    notifySubscribers,
    releaseDate,
    relations,
    sessionFilename,
    status?.id,
    status?.original_filename,
    status?.public_id,
    title,
    videoCode,
    visibility,
  ]);

  useEffect(() => {
    const previousPublicId = prevSearchPublicIdRef.current;
    prevSearchPublicIdRef.current = search.publicId;

    if (search.publicId != null) {
      return;
    }

    // Only reset when the URL explicitly dropped a session publicId.
    // Fresh drafts and post-upload establish navigations must not be wiped.
    if (previousPublicId == null) {
      clearActiveUploadStudioPointer();

      return;
    }

    resumeAppliedRef.current = null;
    uploadStartedRef.current = false;
    clearActiveUploadStudioPointer();
    setStatus(null);
    setPhase("idle");
    setProgressPct(0);
    setMessage(null);
    setFile(null);
    setSessionFilename(null);
    setTitle("");
    setDescription("");
    setVideoCode("");
    setCid("");
    setJancode("");
    setMakerProduct("");
    setReleaseDate("");
    setRelations(EMPTY_RELATIONS);
    setThumbnailUrl("");
    setVisibility("unlisted");
    setNotifySubscribers(true);
    setAutoProcess(true);
    setUpsertDialogOpen(false);
    setConflictExisting(null);
    setConflictMessage(null);
    setActiveStep(1);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [search.publicId]);

  useEffect(() => {
    const publicId = status?.public_id;

    if (publicId == null) {
      return;
    }

    // Only keep step in sync when the URL already targets this upload.
    // Clean /studio/upload (no publicId) is a new session — do not restore.
    if (search.publicId !== publicId) {
      return;
    }

    if (search.step === activeStep) {
      return;
    }

    void navigate({
      to: "/studio/upload",
      search: { publicId, step: activeStep },
      replace: true,
    });
  }, [activeStep, navigate, search.publicId, search.step, status?.public_id]);

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
    setVisibility("unlisted");
    setNotifySubscribers(true);
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
        resumeAppliedRef.current = finalStatus.public_id;

        try {
          const withMetadata = await updateVideoUploadMetadata(finalStatus.public_id, {
            title: title.trim() || finalStatus.title || undefined,
            cid: cid.trim() || null,
            jancode: jancode.trim() || null,
            maker_product: makerProduct.trim() || null,
            release_date: releaseDate.trim() || null,
            actress_ids: relations.actresses,
            maker_ids: relations.makers,
            genre_ids: relations.genres,
            series_ids: relations.series,
            label_ids: relations.labels,
            director_ids: relations.directors,
          });
          setStatus(withMetadata);
        } catch {
          // Upload already completed; catalog links can be retried from Details.
        }

        const nextStep = autoProcess ? 5 : activeStep;

        if (autoProcess) {
          setActiveStep(5);
        }

        void queryClient.invalidateQueries({ queryKey: VIDEO_UPLOADS_LIST_QUERY_KEY });

        void navigate({
          to: "/studio/upload",
          search: { publicId: finalStatus.public_id, step: nextStep },
          replace: true,
        });
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
    [
      activeStep,
      autoProcess,
      cid,
      file,
      jancode,
      makerProduct,
      navigate,
      queryClient,
      relations,
      releaseDate,
      title,
      videoCode,
    ],
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

      // Progressive encode: first READY rung publishes a playable master playlist.
      if (status.status.toUpperCase() === "READY") {
        return true;
      }

      return status.renditions.some((row) => row.status.toUpperCase() === "READY");
    }

    return true;
  }, [activeStep, file, phase, status, title]);

  const busy = phase === "preparing" || phase === "uploading" || phase === "completing";

  const onDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const persistCatalogMetadata = useCallback(async () => {
    const publicId = status?.public_id;

    if (publicId == null) {
      return;
    }

    const updated = await updateVideoUploadMetadata(publicId, {
      title: title.trim() || (status?.title ?? undefined),
      cid: cid.trim() || null,
      jancode: jancode.trim() || null,
      maker_product: makerProduct.trim() || null,
      release_date: releaseDate.trim() || null,
      actress_ids: relations.actresses,
      maker_ids: relations.makers,
      genre_ids: relations.genres,
      series_ids: relations.series,
      label_ids: relations.labels,
      director_ids: relations.directors,
    });
    setStatus(updated);
  }, [cid, jancode, makerProduct, relations, releaseDate, status, title]);

  const handleRecoverRendition = useCallback(
    async (label: string) => {
      const publicId = status?.public_id;

      if (publicId == null || recoveringLabel != null) {
        return;
      }

      setRecoveringLabel(label);
      setMessage(null);

      try {
        const next = await recoverVideoRendition(publicId, label);
        setStatus(next);
        setMessage(`Recovering ${label} encode…`);
      } catch (error) {
        setMessage(getApiErrorMessage(error));
      } finally {
        setRecoveringLabel(null);
      }
    },
    [recoveringLabel, status?.public_id],
  );

  const goNext = () => {
    if (activeStep === 7) {
      return;
    }

    if (activeStep === 2 && status?.public_id != null) {
      void persistCatalogMetadata().catch((error: unknown) => {
        setMessage(getApiErrorMessage(error));
      });
    }

    setActiveStep((step) => Math.min(7, step + 1));
  };

  const goBack = () => {
    if (busy) {
      return;
    }

    // Resumed sessions have no local File — do not drop below Process.
    const minStep = file == null && status != null ? 5 : 1;

    setActiveStep((step) => Math.max(minStep, step - 1));
  };

  return (
    <main className="flex w-full flex-col gap-8">
      <nav
        className="bg-background/95 border-border sticky top-0 z-20 flex w-full flex-wrap items-center gap-2 border-b py-3 backdrop-blur"
        aria-label="Upload progress"
      >
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
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Step {activeStep} of {STEPS.length}
            </span>

            <h2 className="text-xl font-semibold tracking-tight">{stepTitle(activeStep)}</h2>
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

          {activeStep === 5 ? (
            <ProcessStep
              status={status}
              recoveringLabel={recoveringLabel}
              onRecoverRendition={(label) => {
                void handleRecoverRendition(label);
              }}
            />
          ) : null}

          {activeStep === 6 ? <MediaStep publicId={status?.public_id ?? null} /> : null}

          {activeStep === 7 ? (
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
              disabled={!canContinue || (activeStep === 7 && (status == null || phase === "error"))}
              onClick={() => {
                if (activeStep === 7) {
                  if (status == null) {
                    return;
                  }

                  window.open(`/videos/${status.id}`, "_blank", "noopener,noreferrer");

                  return;
                }

                goNext();
              }}
            >
              {activeStep === 7
                ? "Open video page"
                : activeStep === 5
                  ? status != null &&
                    status.renditions.length > 0 &&
                    status.renditions.every((row) => row.status.toUpperCase() === "READY")
                    ? "Continue to media"
                    : "Continue with available stream"
                  : activeStep === 6
                    ? "Continue to preview"
                    : "Continue"}
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
          </div>
        </div>

        <SessionSummary
          fileName={file?.name ?? sessionFilename}
          fileSizeLabel={fileSizeLabel}
          videoCode={videoCode}
          visibility={visibility}
          relations={relations}
          phase={phase}
          progressPct={progressPct}
        />
      </section>

      <UploadsList />

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
