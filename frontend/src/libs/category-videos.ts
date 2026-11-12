import type { Video } from "@/types/video";

export function getTrendingVideos(videos: Array<Video> = []): Array<Video> {
  return [...videos].reverse();
}

export function getLatestVideos(videos: Array<Video> = []): Array<Video> {
  return [...videos].sort((a, b) => {
    const da = a.release_date ? Date.parse(a.release_date) : 0;
    const db = b.release_date ? Date.parse(b.release_date) : 0;

    return db - da;
  });
}

export function getForYouVideos(videos: Array<Video> = []): Array<Video> {
  return [...videos].sort((a, b) => a.id - b.id);
}

export function getAllGenres(
  videos: Array<Video> = [],
): Array<{ id: number; name: string; slug: string; count: number }> {
  const map = new Map<string, { id: number; name: string; count: number }>();

  for (const video of videos) {
    for (const genre of video.genres ?? []) {
      const entry = map.get(genre.name) ?? { id: genre.id, name: genre.name, count: 0 };
      entry.count += 1;
      map.set(genre.name, entry);
    }
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((g) => ({
      ...g,
      slug: g.name.toLowerCase().replace(/\s+/g, "-"),
    }));
}

export function getVideosByGenreSlug(slug: string, videos: Array<Video> = []): Array<Video> {
  const normalized = slug.toLowerCase().replace(/-/g, " ");

  return videos.filter((video) =>
    (video.genres ?? []).some(
      (g) => g.name.toLowerCase() === normalized || g.name.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase(),
    ),
  );
}

export function getGenreNameBySlug(slug: string, videos: Array<Video> = []): string | undefined {
  const genres = getAllGenres(videos);

  return genres.find((g) => g.slug === slug.toLowerCase())?.name;
}
