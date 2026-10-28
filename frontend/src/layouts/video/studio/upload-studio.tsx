import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { UploadStudioSkeleton } from "@/layouts/video/studio/upload-studio-skeleton";
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
  listVideoUploadMedia,
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

const videoUploadMediaQueryKey = (publicId: string) => ["video-upload-media", publicId] as const;

const uploadRouteApi = getRouteApi("/_authenticated/studio/upload");

function scrollStudioMainToTop() {
  const main = document.querySelector<HTMLElement>("[data-studio-main]");

  if (main != null) {
    main.scrollTop = 0;
  }
}

type UploadStudioProps = {
  initialStatus?: VideoUploadStatusResponse | null;
  initialStep?: number;
};

function resolveInitialStep(
  initialStep: number | undefined,
  status: VideoUploadStatusResponse | null | undefined,
): number {
  if (initialStep != null) {
    return Math.min(7, Math.max(1, initialStep));
  }

  if (status != null) {
    return Math.min(7, Math.max(1, defaultStepForStatus(status)));
  }

  return 1;
}

function hydrateFromStatus(status: VideoUploadStatusResponse) {
  const draft = loadUploadStudioSession(status.public_id);

  if (draft != null) {
    return {
      title: draft.title || status.title || "",
      description: draft.description,
      videoCode: draft.videoCode || status.video_id || "",
      cid: draft.cid || status.cid || "",
      jancode: draft.jancode || status.jancode || "",
      makerProduct: draft.makerProduct || status.maker_product || "",
      releaseDate:
        draft.releaseDate ||
        (status.release_date != null && status.release_date.length >= 10 ? status.release_date.slice(0, 10) : ""),
      visibility: draft.visibility,
      notifySubscribers: draft.notifySubscribers,
      relations: draft.relations,
      sessionFilename: draft.originalFilename ?? status.original_filename,
    };
  }

  return {
    title: status.title ?? "",
    description: "",
    videoCode: status.video_id,
    cid: status.cid ?? "",
    jancode: status.jancode ?? "",
    makerProduct: status.maker_product ?? "",
    releaseDate:
      status.release_date != null && status.release_date.length >= 10 ? status.release_date.slice(0, 10) : "",
    visibility: "unlisted" as VisibilityValue,
    notifySubscribers: true,
    relations: {
      actresses: status.actress_ids,
      makers: status.maker_ids,
      genres: status.genre_ids,
      series: status.series_ids,
      labels: status.label_ids,
      directors: status.director_ids,
    },
    sessionFilename: status.original_filename,
  };
}

export function UploadStudio({ initialStatus = null, initialStep }: UploadStudioProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = uploadRouteApi.useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadStartedRef = useRef(initialStatus != null);
  const resumeAppliedRef = useRef<string | null>(initialStatus != null ? initialStatus.public_id : null);
  const prevSearchPublicIdRef = useRef<string | undefined>(search.publicId);
  const hydrated = initialStatus != null ? hydrateFromStatus(initialStatus) : null;

  const [sessionFilename, setSessionFilename] = useState<string | null>(hydrated?.sessionFilename ?? null);

  const [localStep, setLocalStep] = useState(() => resolveInitialStep(initialStep ?? search.step, initialStatus));

  const activeStep = search.step != null ? Math.min(7, Math.max(1, search.step)) : localStep;

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(hydrated?.title ?? "");
  const [description, setDescription] = useState(hydrated?.description ?? "");
  const [videoCode, setVideoCode] = useState(hydrated?.videoCode ?? "");
  const [cid, setCid] = useState(hydrated?.cid ?? "");
  const [jancode, setJancode] = useState(hydrated?.jancode ?? "");
  const [makerProduct, setMakerProduct] = useState(hydrated?.makerProduct ?? "");
  const [releaseDate, setReleaseDate] = useState(hydrated?.releaseDate ?? "");
  const [relations, setRelations] = useState<RelationSelections>(hydrated?.relations ?? EMPTY_RELATIONS);
  const [visibility, setVisibility] = useState<VisibilityValue>(hydrated?.visibility ?? "unlisted");
  const [notifySubscribers, setNotifySubscribers] = useState(hydrated?.notifySubscribers ?? true);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [autoProcess, setAutoProcess] = useState(true);

  const [phase, setPhase] = useState<UploadPhase>(initialStatus != null ? "done" : "idle");
  const [progressPct, setProgressPct] = useState(initialStatus != null ? 100 : 0);
  const [message, setMessage] = useState<string | null>(
    initialStatus != null ? `Resumed upload ${initialStatus.status}` : null,
  );
  const [status, setStatus] = useState<VideoUploadStatusResponse | null>(initialStatus);
  const [recoveringLabel, setRecoveringLabel] = useState<string | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [upsertDialogOpen, setUpsertDialogOpen] = useState(false);
  const [conflictExisting, setConflictExisting] = useState<ExistingVideoSummary | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const commitStep = useCallback(
    (next: number) => {
      const clamped = Math.min(7, Math.max(1, next));

      setLocalStep(clamped);
      scrollStudioMainToTop();

      const publicId = status?.public_id ?? search.publicId;

      if (publicId != null) {
        void navigate({
          to: "/studio/upload",
          search: { publicId, step: clamped },
          replace: true,
        });
      }
    },
    [navigate, search.publicId, status?.public_id],
  );

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

    if (resumeId == null || initialStatus != null || resumeAppliedRef.current === resumeId) {
      return;
    }

    let cancelled = false;

    const resume = async () => {
      try {
        const next = await getVideoUploadStatus(resumeId);

        if (cancelled) {
          return;
        }

        const fields = hydrateFromStatus(next);
        const preferredStep = search.step ?? defaultStepForStatus(next);
        const clampedStep = Math.min(7, Math.max(1, preferredStep));

        resumeAppliedRef.current = resumeId;
        setStatus(next);
        setPhase("done");
        setProgressPct(100);
        uploadStartedRef.current = true;
        setLocalStep(clampedStep);
        setMessage(`Resumed upload ${next.status}`);
        setTitle(fields.title);
        setDescription(fields.description);
        setVideoCode(fields.videoCode);
        setCid(fields.cid);
        setJancode(fields.jancode);
        setMakerProduct(fields.makerProduct);
        setReleaseDate(fields.releaseDate);
        setVisibility(fields.visibility);
        setNotifySubscribers(fields.notifySubscribers);
        setRelations(fields.relations);
        setSessionFilename(fields.sessionFilename);

        if (search.step == null) {
          void navigate({
            to: "/studio/upload",
            search: { publicId: resumeId, step: clampedStep },
            replace: true,
          });
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
  }, [initialStatus, navigate, search.publicId, search.step]);

  const contentReady = search.publicId == null || (status != null && status.public_id === search.publicId);

  useLayoutEffect(() => {
    if (!contentReady) {
      return;
    }

    scrollStudioMainToTop();
  }, [activeStep, contentReady, search.publicId]);

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
    // Fresh drafts and post-upload establish navigation must not be wiped.
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
    setLocalStep(1);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [search.publicId]);

  const sourceBytes = status?.source_bytes;

  const fileSizeLabel = useMemo(() => {
    if (file) {
      return formatFileSize(file.size);
    }

    if (sourceBytes != null && sourceBytes > 0) {
      return formatFileSize(sourceBytes);
    }

    return "";
  }, [file, sourceBytes]);

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
    setLocalStep(2);
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
    setLocalStep(1);

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

        setLocalStep(nextStep);

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
    setLocalStep(2);
  }, [conflictExisting]);

  useEffect(() => {
    if (activeStep === 4 && file && phase === "idle" && !uploadStartedRef.current && !upsertDialogOpen) {
      void runUpload();
    }
  }, [activeStep, file, phase, runUpload, upsertDialogOpen]);

  const canContinue = useMemo(() => {
    if (activeStep === 1) {
      return Boolean(file) || status != null;
    }

    if (activeStep === 2) {
      return Boolean(title.trim());
    }

    if (activeStep === 4) {
      return phase === "done" || status != null;
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

  const statusPublicId = status?.public_id ?? null;

  const { data: uploadMedia } = useQuery({
    queryKey: statusPublicId != null ? videoUploadMediaQueryKey(statusPublicId) : ["video-upload-media", "none"],
    queryFn: () => listVideoUploadMedia(statusPublicId as string),
    enabled: statusPublicId != null,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (statusPublicId == null) {
      return;
    }

    if (activeStep !== 6 && activeStep !== 7) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: videoUploadMediaQueryKey(statusPublicId) });
  }, [activeStep, queryClient, statusPublicId]);

  const hasCatalogMedia = useMemo(() => {
    if (uploadMedia == null) {
      return false;
    }

    return uploadMedia.thumbnails.length > 0 || uploadMedia.samples.length > 0;
  }, [uploadMedia]);

  const isProcessComplete = useMemo(() => {
    if (status == null) {
      return false;
    }

    return status.status.toUpperCase() === "READY";
  }, [status]);

  const isStepComplete = useCallback(
    (stepNumber: number) => {
      switch (stepNumber) {
        case 1:
          return file != null || status != null;
        case 2:
          return Boolean(title.trim());
        case 3:
          return file != null || status != null;
        case 4:
          return phase === "done" || status != null;
        case 5:
          return isProcessComplete;
        case 6:
          return hasCatalogMedia;
        case 7:
          return isProcessComplete;
        default:
          return false;
      }
    },
    [file, hasCatalogMedia, isProcessComplete, phase, status, title],
  );

  const onDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const persistCatalogMetadata = useCallback(async () => {
    const publicId = status?.public_id;

    if (publicId == null) {
      return null;
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
    void queryClient.invalidateQueries({ queryKey: VIDEO_UPLOADS_LIST_QUERY_KEY });

    return updated;
  }, [cid, jancode, makerProduct, queryClient, relations, releaseDate, status, title]);

  const handleUpdateCatalog = useCallback(async () => {
    if (status?.public_id == null || savingMetadata) {
      return;
    }

    if (!title.trim()) {
      setMessage("Title is required to update catalog details.");
      setPhase("error");

      return;
    }

    setSavingMetadata(true);
    setMessage(null);

    try {
      await persistCatalogMetadata();
      setPhase("done");
      setMessage("Catalog details updated.");
    } catch (error) {
      setPhase("error");
      setMessage(getApiErrorMessage(error));
    } finally {
      setSavingMetadata(false);
    }
  }, [persistCatalogMetadata, savingMetadata, status?.public_id, title]);

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
      if (savingMetadata) {
        return;
      }

      setSavingMetadata(true);
      setMessage(null);

      void persistCatalogMetadata()
        .then(() => {
          commitStep(Math.min(7, activeStep + 1));
        })
        .catch((error: unknown) => {
          setPhase("error");
          setMessage(getApiErrorMessage(error));
        })
        .finally(() => {
          setSavingMetadata(false);
        });

      return;
    }

    commitStep(Math.min(7, activeStep + 1));
  };

  const goBack = () => {
    if (busy) {
      return;
    }

    commitStep(Math.max(1, activeStep - 1));
  };

  const canGoToStep = useCallback(
    (target: number) => {
      if (target < 1 || target > STEPS.length) {
        return false;
      }

      if (busy || savingMetadata) {
        return false;
      }

      if (target === activeStep) {
        return true;
      }

      if (target < activeStep) {
        return true;
      }

      if (target >= 2 && file == null && status == null) {
        return false;
      }

      if (target >= 2 && !title.trim() && status == null) {
        return false;
      }

      if (target >= 5 && status == null) {
        return false;
      }

      if (target >= 6 && status == null) {
        return false;
      }

      return true;
    },
    [activeStep, busy, file, savingMetadata, status, title],
  );

  const goToStep = useCallback(
    (target: number) => {
      if (!canGoToStep(target) || target === activeStep) {
        return;
      }

      if (activeStep === 2 && status?.public_id != null && target !== 2) {
        if (savingMetadata) {
          return;
        }

        setSavingMetadata(true);
        setMessage(null);

        void persistCatalogMetadata()
          .then(() => {
            commitStep(target);
          })
          .catch((error: unknown) => {
            setPhase("error");
            setMessage(getApiErrorMessage(error));
          })
          .finally(() => {
            setSavingMetadata(false);
          });

        return;
      }

      commitStep(target);
    },
    [activeStep, canGoToStep, commitStep, persistCatalogMetadata, savingMetadata, status?.public_id],
  );

  if (!contentReady) {
    return <UploadStudioSkeleton activeStep={search.step ?? 7} />;
  }

  return (
    <main className="flex w-full flex-col gap-8">
      <nav
        className="bg-background/95 border-border sticky top-0 z-20 flex w-full flex-wrap items-center gap-2 border-b py-3 backdrop-blur"
        aria-label="Upload progress"
      >
        {STEPS.map((step) => {
          const reachable = canGoToStep(step.number);
          const isCurrent = activeStep === step.number;
          const isComplete = isStepComplete(step.number);

          return (
            <div key={step.number} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Go to step ${step.number}: ${step.label}`}
                onClick={() => {
                  goToStep(step.number);
                }}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-lg text-left transition-opacity",
                  reachable ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {isComplete && !isCurrent ? <Check className="size-4" /> : step.number}
                </span>

                <span
                  className={cn(
                    "hidden truncate text-xs sm:inline",
                    isCurrent ? "font-medium" : isComplete ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {step.number < STEPS.length ? <div className="bg-border mx-1 hidden h-px flex-1 sm:block" /> : null}
            </div>
          );
        })}
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
              <Button type="button" variant="outline" disabled={busy || savingMetadata} onClick={goBack}>
                <ArrowLeft data-icon="inline-start" className="size-4" />
                Back
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              {activeStep === 2 && status?.public_id != null ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!title.trim() || savingMetadata || busy}
                  onClick={() => {
                    void handleUpdateCatalog();
                  }}
                >
                  {savingMetadata ? "Updating…" : "Update catalog"}
                </Button>
              ) : null}

              <Button
                type="button"
                disabled={!canContinue || savingMetadata || (activeStep === 7 && (status == null || phase === "error"))}
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
                      : activeStep === 2 && status?.public_id != null && savingMetadata
                        ? "Saving…"
                        : "Continue"}
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Button>
            </div>
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
