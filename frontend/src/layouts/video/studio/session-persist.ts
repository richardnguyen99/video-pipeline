import type { RelationSelections, VisibilityValue } from "@/layouts/video/studio/types";
import { EMPTY_RELATIONS } from "@/layouts/video/studio/types";

const STORAGE_PREFIX = "vp.upload-studio.session.";

export type UploadStudioSessionSnapshot = {
  publicId: string;
  activeStep: number;
  title: string;
  description: string;
  videoCode: string;
  cid: string;
  jancode: string;
  makerProduct: string;
  releaseDate: string;
  visibility: VisibilityValue;
  notifySubscribers: boolean;
  relations: RelationSelections;
  originalFilename: string | null;
  videoRowId: number | null;
};

function storageKey(publicId: string): string {
  return `${STORAGE_PREFIX}${publicId}`;
}

export function saveUploadStudioSession(snapshot: UploadStudioSessionSnapshot): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(storageKey(snapshot.publicId), JSON.stringify(snapshot));
  } catch {
    // Quota / private mode — ignore; URL resume still works.
  }
}

export function loadUploadStudioSession(publicId: string): UploadStudioSessionSnapshot | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(storageKey(publicId));

    if (raw == null || raw.length === 0) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UploadStudioSessionSnapshot>;

    if (parsed.publicId !== publicId) {
      return null;
    }

    return {
      publicId,
      activeStep:
        typeof parsed.activeStep === "number" && parsed.activeStep >= 1 && parsed.activeStep <= 7
          ? parsed.activeStep
          : 5,
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      videoCode: typeof parsed.videoCode === "string" ? parsed.videoCode : "",
      cid: typeof parsed.cid === "string" ? parsed.cid : "",
      jancode: typeof parsed.jancode === "string" ? parsed.jancode : "",
      makerProduct: typeof parsed.makerProduct === "string" ? parsed.makerProduct : "",
      releaseDate: typeof parsed.releaseDate === "string" ? parsed.releaseDate : "",
      visibility:
        parsed.visibility === "public" || parsed.visibility === "unlisted" || parsed.visibility === "private"
          ? parsed.visibility
          : "unlisted",
      notifySubscribers: parsed.notifySubscribers !== false,
      relations: {
        actresses: parsed.relations?.actresses ?? EMPTY_RELATIONS.actresses,
        makers: parsed.relations?.makers ?? EMPTY_RELATIONS.makers,
        genres: parsed.relations?.genres ?? EMPTY_RELATIONS.genres,
        series: parsed.relations?.series ?? EMPTY_RELATIONS.series,
        labels: parsed.relations?.labels ?? EMPTY_RELATIONS.labels,
        directors: parsed.relations?.directors ?? EMPTY_RELATIONS.directors,
      },
      originalFilename: typeof parsed.originalFilename === "string" ? parsed.originalFilename : null,
      videoRowId: typeof parsed.videoRowId === "number" ? parsed.videoRowId : null,
    };
  } catch {
    return null;
  }
}

export function clearUploadStudioSession(publicId: string): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(storageKey(publicId));
  } catch {
    // ignore
  }
}

/** Infer the earliest sensible wizard step for a restored upload status. */
export function defaultStepForStatus(status: { status: string; renditions: Array<{ status: string }> }): number {
  const pipeline = status.status.toUpperCase();

  if (pipeline === "FAILED") {
    return 5;
  }

  const allReady =
    status.renditions.length > 0 && status.renditions.every((row) => row.status.toUpperCase() === "READY");

  if (allReady || pipeline === "READY") {
    return 5;
  }

  if (
    pipeline === "UPLOADED" ||
    pipeline === "PROBING" ||
    pipeline === "QUEUED" ||
    pipeline === "ENCODING" ||
    status.renditions.some((row) => row.status.toUpperCase() === "ENCODING")
  ) {
    return 5;
  }

  return 5;
}
