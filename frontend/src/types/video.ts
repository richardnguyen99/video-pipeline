import type { VideoComment } from "@/queries/comments";

export interface CatalogEntityAka {
  id: number;
  translated_name: string;
  language: string;
}

export interface NamedEntity {
  id: number;
  name: string;
  ruby?: string | null;
  dmm_id?: string | null;
  aka?: CatalogEntityAka | null;
}

export function catalogEntityDisplayName(entity: NamedEntity): string {
  const translated = entity.aka?.translated_name.trim();

  if (translated) {
    return translated;
  }

  return entity.name;
}

export interface ActressImage {
  id: number;
  url: string;
  attribute?: string | null;
}

export interface ActressAka {
  id: number;
  translated_name: string;
  name?: string;
}

export interface ActressRef extends NamedEntity {
  image_url?: string;
  actress_image?: Array<ActressImage>;
  actress_aka?: ActressAka | null;
  ruby?: string | null;
  dmm_id?: string | null;
}

export function actressDisplayName(actress: ActressRef): string {
  const translated = actress.actress_aka?.translated_name.trim();

  if (translated) {
    return translated;
  }

  return actress.name;
}

const ACTRESS_IMAGE_ATTRIBUTE_PRIORITY = ["default", "avatar"] as const;

export function pickActressImageUrl(
  items: Array<{ url: string; attribute?: string | null }> | undefined,
  priority: ReadonlyArray<string> = ACTRESS_IMAGE_ATTRIBUTE_PRIORITY,
): string | undefined {
  if (items == null || items.length === 0) {
    return undefined;
  }

  const withUrl = items.filter((item) => item.url !== "");

  for (const preferred of priority) {
    const match = withUrl.find((item) => item.attribute?.trim().toLowerCase() === preferred);

    if (match != null) {
      return match.url;
    }
  }

  return withUrl[0]?.url;
}

export interface VideoImageUrl {
  id: number;
  url: string;
  type?: string | null;
}

const VIDEO_IMAGE_TYPE_PRIORITY = ["large", "small", "list"] as const;

export function pickVideoImageUrl(
  items: Array<{ url: string; type?: string | null }> | undefined,
  priority: ReadonlyArray<string> = VIDEO_IMAGE_TYPE_PRIORITY,
): string | undefined {
  if (items == null || items.length === 0) {
    return undefined;
  }

  for (const preferred of priority) {
    const match = items.find((item) => item.url !== "" && item.type?.trim().toLowerCase() === preferred);

    if (match != null) {
      return match.url;
    }
  }

  return items.find((item) => item.url !== "")?.url;
}

const VIDEO_SAMPLE_IMAGE_TYPE_PRIORITY = ["sample_l", "sample_gen", "sample_s"] as const;

export function pickVideoSampleImages<T extends { url: string; type?: string | null }>(
  items: Array<T> | undefined,
  priority: ReadonlyArray<string> = VIDEO_SAMPLE_IMAGE_TYPE_PRIORITY,
): Array<T> {
  if (items == null || items.length === 0) {
    return [];
  }

  const withUrl = items.filter((item) => item.url !== "");

  for (const preferred of priority) {
    const matched = withUrl.filter((item) => item.type?.trim().toLowerCase() === preferred);

    if (matched.length > 0) {
      return matched;
    }
  }

  return withUrl;
}

export interface VideoVideoSampleImageUrlUrl {
  id: number;
  url: string;
  type?: string | null;
}

export interface VideoSampleMovieUrl {
  id: number;
  url: string;
  type?: string | null;
}

export interface VideoAka {
  id: number;
  translated_name: string;
  language: string;
}

export interface Video {
  id: number;
  video_id: string;
  title: string;
  video_aka?: VideoAka | null;
  cid?: string;
  duration?: number;
  release_date?: string;
  jancode?: string;
  maker_product?: string;
  floor_code?: string;
  public_id?: string | null;
  uploader_id?: string | null;
  image_urls?: Array<string>;
  video_image_url?: Array<VideoImageUrl>;
  sample_image_url?: Array<VideoVideoSampleImageUrlUrl>;
  video_sample_image_url?: Array<VideoVideoSampleImageUrlUrl>;
  sample_movie_url?: Array<VideoSampleMovieUrl>;
  m3u8_url?: string | null;
  m3u8_urls?: Array<string>;
  views?: number;
  likes?: number;
  dislikes?: number;
  /** Detail payloads: comment tree. List payloads: aggregate count. */
  comments?: Array<VideoComment>;
  makers?: Array<NamedEntity>;
  labels?: Array<NamedEntity>;
  directors?: Array<NamedEntity>;
  series?: Array<NamedEntity> | NamedEntity | null;
  maker?: NamedEntity | null;
  label?: NamedEntity | null;
  director?: NamedEntity | null;
  actresses?: Array<ActressRef>;
  genres?: Array<NamedEntity>;
}

export function videoDisplayTitle(video: Pick<Video, "title" | "video_aka">): string {
  const translated = video.video_aka?.translated_name.trim();

  if (translated) {
    return translated;
  }

  return video.title;
}

export function normalizeVideoEntities(
  items: Array<NamedEntity> | NamedEntity | null | undefined,
  fallback?: NamedEntity | null,
): Array<NamedEntity> {
  if (Array.isArray(items)) {
    return items;
  }

  if (items != null) {
    return [items];
  }

  if (fallback != null) {
    return [fallback];
  }

  return [];
}
