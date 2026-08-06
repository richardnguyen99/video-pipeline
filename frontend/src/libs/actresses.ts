import { mockActressCatalog } from "@/mocks/actresses";
import type { ActressRef, Video } from "@/mocks/videos";
import { mockVideos } from "@/mocks/videos";

export const ACTRESSES_PAGE_SIZE = 20;

/** Aligns with backend `Actress` profile fields used in UI. */
export interface ActressSummary extends ActressRef {
  ruby?: string | null;
  birthday?: string | null;
  bust?: number | null;
  cup?: string | null;
  waist?: number | null;
  hip?: number | null;
  height?: number | null;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  subscribers: number;
}

function engagementFromVideos(
  videos: Video[],
): Map<number, { videoCount: number; totalViews: number; totalLikes: number; totalComments: number }> {
  const map = new Map<number, { videoCount: number; totalViews: number; totalLikes: number; totalComments: number }>();
  for (const video of videos) {
    for (const actress of video.actresses ?? []) {
      const cur = map.get(actress.id) ?? {
        videoCount: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
      };
      cur.videoCount += 1;
      cur.totalViews += video.views ?? 0;
      cur.totalLikes += video.likes ?? 0;
      cur.totalComments += video.comments ?? 0;
      map.set(actress.id, cur);
    }
  }
  return map;
}

export function getActressSummaries(videos: Video[] = mockVideos): ActressSummary[] {
  const engagement = engagementFromVideos(videos);

  return mockActressCatalog.map((profile, index) => {
    const stats = engagement.get(profile.id);
    const seed = profile.id * 17 + index;
    return {
      id: profile.id,
      name: profile.name,
      image_url: profile.image_url,
      ruby: profile.ruby ?? null,
      birthday: profile.birthday ?? null,
      bust: profile.bust ?? null,
      cup: profile.cup ?? null,
      waist: profile.waist ?? null,
      hip: profile.hip ?? null,
      height: profile.height ?? null,
      videoCount: stats?.videoCount ?? 1 + (seed % 12),
      totalViews: stats?.totalViews ?? 5_000 + seed * 130,
      totalLikes: stats?.totalLikes ?? 200 + seed * 3,
      totalComments: stats?.totalComments ?? 20 + (seed % 90),
      subscribers: 1_000 + seed * 11,
    };
  });
}

export function getActressById(id: number, videos: Video[] = mockVideos): ActressSummary | undefined {
  return getActressSummaries(videos).find((a) => a.id === id);
}

export function getVideosByActressId(id: number, videos: Video[] = mockVideos): Video[] {
  return videos.filter((v) => (v.actresses ?? []).some((a) => a.id === id));
}

export function getActressPage(
  page: number,
  pageSize: number = ACTRESSES_PAGE_SIZE,
  videos: Video[] = mockVideos,
): {
  items: ActressSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
  const all = getActressSummaries(videos);
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: all.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

export function formatAge(birthday?: string | null): number | null {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function formatBirthdayLabel(birthday?: string | null): string | null {
  if (!birthday) return null;
  const age = formatAge(birthday);
  if (age == null) return birthday;
  return `${birthday} (${age})`;
}

export function formatMeasurements(actress: ActressSummary): string | null {
  const parts: string[] = [];
  if (actress.bust != null) {
    parts.push(actress.cup ? `B${actress.bust}${actress.cup}` : `B${actress.bust}`);
  } else if (actress.cup) {
    parts.push(`Cup ${actress.cup}`);
  }
  if (actress.waist != null) parts.push(`W${actress.waist}`);
  if (actress.hip != null) parts.push(`H${actress.hip}`);
  if (actress.height != null) parts.push(`${actress.height}cm`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
