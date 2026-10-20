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
};

export type CreateVideoUploadInput = {
  filename: string;
  content_type: string;
  size_bytes: number;
  title?: string;
  part_size_bytes?: number;
};

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
