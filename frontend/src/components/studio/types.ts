import type { ExistingVideoSummary, VideoUploadStatusResponse } from "@/queries/video-upload";

export const RELATION_KEYS = ["actresses", "makers", "genres", "series", "labels", "directors"] as const;

export type RelationKey = (typeof RELATION_KEYS)[number];

export type RelationSelections = Record<RelationKey, Array<number>>;

export const EMPTY_RELATIONS: RelationSelections = {
  actresses: [],
  makers: [],
  genres: [],
  series: [],
  labels: [],
  directors: [],
};

export const STEPS = [
  { number: 1, label: "Select file" },
  { number: 2, label: "Details" },
  { number: 3, label: "Visibility" },
  { number: 4, label: "Upload" },
  { number: 5, label: "Process" },
  { number: 6, label: "Thumbnails & samples" },
  { number: 7, label: "Preview & publish" },
] as const;

export const ALLOWED_EXTENSIONS = ["mp4", "mkv", "mov", "webm"] as const;

export const VISIBILITY_OPTIONS = [
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

export type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];

export type UploadPhase = "idle" | "preparing" | "uploading" | "completing" | "done" | "error" | "conflict";

export type StudioDetails = {
  title: string;
  description: string;
  videoCode: string;
  cid: string;
  jancode: string;
  makerProduct: string;
  releaseDate: string;
  relations: RelationSelections;
  notifySubscribers: boolean;
};

export type StudioPreviewModel = StudioDetails & {
  fileName: string | null;
  visibility: VisibilityValue;
  status: VideoUploadStatusResponse | null;
};

export type ConflictState = {
  existing: ExistingVideoSummary | null;
  message: string | null;
};
