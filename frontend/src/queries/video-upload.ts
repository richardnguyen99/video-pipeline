import { apiFetch } from "@/libs/api-client";

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
  original_filename: string | null;
  source_key: string | null;
  source_bytes: number | null;
  title: string | null;
  error_code: string | null;
  error_message: string | null;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
  overall_progress_pct: number;
  renditions: Array<VideoRenditionProgress>;
};

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

  const body = error.body;

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

export const DEFAULT_PART_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_PARALLEL_PARTS = 4;
