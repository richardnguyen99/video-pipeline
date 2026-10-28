import { queryOptions } from "@tanstack/react-query";

import { apiFetch, getApiBaseUrl } from "@/libs/api-client";
import { getAccessToken } from "@/stores/auth-store";

export type PresignedPart = {
  part_number: number;
  url: string;
};

export type VideoUploadCreateResponse = {
  id: number;
  public_id: string;
  status: string;
  source_key: string;
  multipart_upload_id: string;
  part_size_bytes: number;
  part_count: number;
  parts: Array<PresignedPart>;
};

export type VideoRenditionProgress = {
  label: string;
  width: number;
  height: number;
  video_kbps: number;
  status: string;
  progress_pct: number;
  attempt: number;
  segment_count: number | null;
  playlist_key: string | null;
};

export type VideoUploadStatusResponse = {
  id: number;
  public_id: string;
  status: string;
  video_id: string;
  original_filename: string | null;
  source_key: string | null;
  source_bytes: number | null;
  title: string | null;
  cid: string | null;
  jancode: string | null;
  maker_product: string | null;
  release_date: string | null;
  error_code: string | null;
  error_message: string | null;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
  overall_progress_pct: number;
  renditions: Array<VideoRenditionProgress>;
  actress_ids: Array<number>;
  maker_ids: Array<number>;
  genre_ids: Array<number>;
  series_ids: Array<number>;
  label_ids: Array<number>;
  director_ids: Array<number>;
};

export type VideoUploadMetadataUpdateInput = {
  title?: string;
  cid?: string | null;
  jancode?: string | null;
  maker_product?: string | null;
  release_date?: string | null;
  actress_ids?: Array<number>;
  maker_ids?: Array<number>;
  genre_ids?: Array<number>;
  series_ids?: Array<number>;
  label_ids?: Array<number>;
  director_ids?: Array<number>;
};

export type VideoUploadListItem = {
  id: number;
  public_id: string;
  video_id: string;
  status: string;
  title: string | null;
  original_filename: string | null;
  source_bytes: number | null;
  error_code: string | null;
  error_message: string | null;
  overall_progress_pct: number;
  resumable: boolean;
  stream_ready: boolean;
  created_at: string;
  updated_at: string;
};

export type VideoUploadListResponse = {
  items: Array<VideoUploadListItem>;
  total: number;
};

export type VideoMediaImageItem = {
  id: number;
  url: string;
  type: string | null;
};

export type VideoMediaResponse = {
  public_id: string;
  video_id: number;
  thumbnails: Array<VideoMediaImageItem>;
  samples: Array<VideoMediaImageItem>;
};

export type ThumbnailImageType = "large" | "list" | "small";
export type SampleImageType = "sample_l" | "sample_s";

export type CreateVideoUploadInput = {
  filename: string;
  content_type: string;
  size_bytes: number;
  title?: string;
  video_code?: string;
  allow_upsert?: boolean;
  part_size_bytes?: number;
};

export type ExistingVideoSummary = {
  id: number;
  video_id: string;
  title: string | null;
  cid: string | null;
  jancode: string | null;
  maker_product: string | null;
  release_date: string | null;
  status: string | null;
  public_id: string | null;
  actress_ids: Array<number>;
  maker_ids: Array<number>;
  genre_ids: Array<number>;
  series_ids: Array<number>;
  label_ids: Array<number>;
  director_ids: Array<number>;
};

export type VideoCodeConflictDetail = {
  code: string;
  message: string;
  existing: ExistingVideoSummary;
};

function isExistingVideoSummary(value: unknown): value is ExistingVideoSummary {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const id = record.id;
  const videoId = record.video_id;

  return (
    (typeof id === "number" || (typeof id === "string" && id.length > 0)) &&
    typeof videoId === "string" &&
    videoId.length > 0
  );
}

function normalizeExistingSummary(value: ExistingVideoSummary): ExistingVideoSummary {
  return {
    ...value,
    id: typeof value.id === "number" ? value.id : Number(value.id),
    actress_ids: Array.isArray(value.actress_ids) ? value.actress_ids : [],
    maker_ids: Array.isArray(value.maker_ids) ? value.maker_ids : [],
    genre_ids: Array.isArray(value.genre_ids) ? value.genre_ids : [],
    series_ids: Array.isArray(value.series_ids) ? value.series_ids : [],
    label_ids: Array.isArray(value.label_ids) ? value.label_ids : [],
    director_ids: Array.isArray(value.director_ids) ? value.director_ids : [],
  };
}

/** Parse structured 409 body from create upload when video_code already exists. */
export function parseVideoCodeConflict(error: unknown): VideoCodeConflictDetail | null {
  if (typeof error !== "object" || error === null || !("body" in error)) {
    return null;
  }

  const body: unknown = error.body;

  if (typeof body !== "object" || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  let detail: unknown = record.detail;

  // Some error envelopes nest under `error.detail`.
  if (
    (detail == null || typeof detail !== "object") &&
    typeof record.error === "object" &&
    record.error !== null &&
    "detail" in record.error
  ) {
    detail = record.error.detail;
  }

  if (typeof detail !== "object" || detail === null) {
    return null;
  }

  const detailRecord = detail as Record<string, unknown>;

  if (typeof detailRecord.message !== "string") {
    return null;
  }

  if (!isExistingVideoSummary(detailRecord.existing)) {
    return null;
  }

  return {
    code: typeof detailRecord.code === "string" ? detailRecord.code : "VIDEO_ID_EXISTS",
    message: detailRecord.message,
    existing: normalizeExistingSummary(detailRecord.existing),
  };
}

export type CompletedPart = {
  part_number: number;
  etag: string;
};

export async function createVideoUpload(input: CreateVideoUploadInput): Promise<VideoUploadCreateResponse> {
  return apiFetch<VideoUploadCreateResponse>("/videos/uploads", {
    method: "POST",
    data: input,
  });
}

export const MAX_PRESIGN_PARTS_PER_REQUEST = 100;

export async function presignVideoUploadParts(
  publicId: string,
  multipartUploadId: string,
  partNumbers: Array<number>,
): Promise<Array<PresignedPart>> {
  if (partNumbers.length === 0) {
    return [];
  }

  const parts: Array<PresignedPart> = [];

  for (let offset = 0; offset < partNumbers.length; offset += MAX_PRESIGN_PARTS_PER_REQUEST) {
    const batch = partNumbers.slice(offset, offset + MAX_PRESIGN_PARTS_PER_REQUEST);
    const response = await apiFetch<{ parts: Array<PresignedPart> }>(`/videos/uploads/${publicId}/parts`, {
      method: "POST",
      data: {
        multipart_upload_id: multipartUploadId,
        part_numbers: batch,
      },
    });
    parts.push(...response.parts);
  }

  return parts;
}

export async function completeVideoUpload(
  publicId: string,
  multipartUploadId: string,
  parts: Array<CompletedPart>,
): Promise<VideoUploadStatusResponse> {
  return apiFetch<VideoUploadStatusResponse>(`/videos/uploads/${publicId}/complete`, {
    method: "POST",
    data: {
      multipart_upload_id: multipartUploadId,
      parts,
    },
  });
}

export async function getVideoUploadStatus(publicId: string): Promise<VideoUploadStatusResponse> {
  return apiFetch<VideoUploadStatusResponse>(`/videos/uploads/${publicId}`);
}

export const videoUploadStatusQueryKey = (publicId: string) => ["video-upload-status", publicId] as const;

export function videoUploadStatusQueryOptions(publicId: string) {
  return queryOptions({
    queryKey: videoUploadStatusQueryKey(publicId),
    queryFn: () => getVideoUploadStatus(publicId),
  });
}

export async function updateVideoUploadMetadata(
  publicId: string,
  input: VideoUploadMetadataUpdateInput,
): Promise<VideoUploadStatusResponse> {
  return apiFetch<VideoUploadStatusResponse>(`/videos/uploads/${publicId}/metadata`, {
    method: "PATCH",
    data: input,
  });
}

export async function recoverVideoRendition(publicId: string, label: string): Promise<VideoUploadStatusResponse> {
  const encoded = encodeURIComponent(label);

  return apiFetch<VideoUploadStatusResponse>(`/videos/uploads/${publicId}/renditions/${encoded}/recover`, {
    method: "POST",
  });
}

export const VIDEO_UPLOADS_LIST_QUERY_KEY = ["video-uploads", "list"] as const;

export async function listVideoUploads(options?: {
  limit?: number;
  offset?: number;
}): Promise<VideoUploadListResponse> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return apiFetch<VideoUploadListResponse>(`/videos/uploads?limit=${String(limit)}&offset=${String(offset)}`);
}

export async function listVideoUploadMedia(publicId: string): Promise<VideoMediaResponse> {
  return apiFetch<VideoMediaResponse>(`/videos/uploads/${publicId}/media`);
}

export async function uploadVideoThumbnail(
  publicId: string,
  imageType: ThumbnailImageType,
  file: File,
): Promise<VideoMediaResponse> {
  const body = new FormData();
  body.append("image_type", imageType);
  body.append("file", file);

  return apiFetch<VideoMediaResponse>(`/videos/uploads/${publicId}/media/thumbnails`, {
    method: "POST",
    data: body,
  });
}

export async function deleteVideoThumbnail(
  publicId: string,
  imageType: ThumbnailImageType,
): Promise<VideoMediaResponse> {
  return apiFetch<VideoMediaResponse>(`/videos/uploads/${publicId}/media/thumbnails/${imageType}`, {
    method: "DELETE",
  });
}

export async function uploadVideoSamples(
  publicId: string,
  imageType: SampleImageType,
  files: Array<File>,
): Promise<VideoMediaResponse> {
  const body = new FormData();
  body.append("image_type", imageType);

  for (const file of files) {
    body.append("files", file);
  }

  return apiFetch<VideoMediaResponse>(`/videos/uploads/${publicId}/media/samples`, {
    method: "POST",
    data: body,
  });
}

export async function deleteVideoSample(publicId: string, sampleId: number): Promise<VideoMediaResponse> {
  return apiFetch<VideoMediaResponse>(`/videos/uploads/${publicId}/media/samples/${sampleId}`, {
    method: "DELETE",
  });
}

export type LiveRungProgress = {
  label: string;
  width: number;
  height: number;
  video_kbps: number;
  status: string;
  progress_pct: number;
  segment_count: number | null;
  playlist_key: string | null;
};

export type LiveTranscodeProgress = {
  status: string;
  overall_pct: number;
  message: string;
  updated_at: string;
  rungs: Array<LiveRungProgress>;
};

function isLiveTranscodeProgress(value: unknown): value is LiveTranscodeProgress {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.status === "string" && Array.isArray(record.rungs);
}

function mergeLiveProgress(
  previous: VideoUploadStatusResponse,
  live: LiveTranscodeProgress,
): VideoUploadStatusResponse {
  return {
    ...previous,
    status: live.status.length > 0 ? live.status : previous.status,
    overall_progress_pct: live.overall_pct,
    renditions: live.rungs.map((rung) => ({
      label: rung.label,
      width: rung.width,
      height: rung.height,
      video_kbps: rung.video_kbps,
      status: rung.status,
      progress_pct: rung.progress_pct,
      attempt: 0,
      segment_count: rung.segment_count,
      playlist_key: rung.playlist_key,
    })),
  };
}

const TERMINAL_UPLOAD_STATUSES = new Set(["READY", "FAILED"]);

function isTerminalUploadStatus(status: string): boolean {
  return TERMINAL_UPLOAD_STATUSES.has(status.toUpperCase());
}

function isTerminalLiveProgress(live: LiveTranscodeProgress): boolean {
  if (isTerminalUploadStatus(live.status)) {
    return true;
  }

  if (live.rungs.length === 0) {
    return false;
  }

  return live.rungs.every((row) => row.status.toUpperCase() === "READY");
}

function isTerminalStatusResponse(next: VideoUploadStatusResponse): boolean {
  if (isTerminalUploadStatus(next.status)) {
    return true;
  }

  if (next.renditions.length === 0) {
    return false;
  }

  return next.renditions.every((row) => row.status.toUpperCase() === "READY");
}

/**
 * Subscribe to Redis-backed SSE progress. Falls back to polling when the
 * stream cannot be opened (proxy, offline, auth).
 *
 * Stops automatically when the upload reaches a terminal state (READY /
 * FAILED, or every rendition READY). Does not keep polling after encode
 * finishes.
 *
 * ``onLive`` receives each progress frame; ``onStatus`` receives full
 * status responses from the polling fallback.
 */
export function subscribeVideoUploadProgress(
  publicId: string,
  onLive: (live: LiveTranscodeProgress) => void,
  onStatus: (next: VideoUploadStatusResponse) => void,
): () => void {
  const controller = new AbortController();
  let generation = 0;
  let pollTimer: number | null = null;

  const stop = () => {
    generation += 1;
    controller.abort();

    if (pollTimer != null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const isActive = (snapshot: number): boolean => snapshot === generation;

  const startPoll = () => {
    if (pollTimer != null) {
      return;
    }

    const snapshot = generation;

    const tick = async () => {
      if (!isActive(snapshot)) {
        return;
      }

      try {
        const next = await getVideoUploadStatus(publicId);

        if (!isActive(snapshot)) {
          return;
        }

        onStatus(next);

        if (isTerminalStatusResponse(next)) {
          stop();
        }
      } catch (error: unknown) {
        void error;
      }
    };

    void tick();
    pollTimer = window.setInterval(() => {
      void tick();
    }, 2000);
  };

  const runStream = async () => {
    const token = getAccessToken();
    const snapshot = generation;

    if (token == null || token.length === 0) {
      startPoll();

      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/videos/uploads/${publicId}/events`, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!isActive(snapshot)) {
        return;
      }

      if (!response.ok || response.body == null) {
        startPoll();

        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (isActive(snapshot)) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (!isActive(snapshot)) {
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));

          if (dataLine == null) {
            continue;
          }

          const raw = dataLine.slice(5).trim();

          if (raw.length === 0) {
            continue;
          }

          try {
            const parsed: unknown = JSON.parse(raw);

            if (!isLiveTranscodeProgress(parsed)) {
              continue;
            }

            onLive(parsed);

            if (isTerminalLiveProgress(parsed)) {
              stop();

              return;
            }
          } catch (error: unknown) {
            void error;
          }
        }
      }

      if (isActive(snapshot)) {
        startPoll();
      }
    } catch (error: unknown) {
      if (isActive(snapshot) && !controller.signal.aborted) {
        startPoll();
      }

      void error;
    }
  };

  void runStream();

  return () => {
    stop();
  };
}

export { mergeLiveProgress };

export const DEFAULT_PART_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_PARALLEL_PARTS = 4;
