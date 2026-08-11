export interface NamedEntity {
  id: number;
  name: string;
}

export interface ActressRef extends NamedEntity {
  image_url?: string;
}

export interface VideoImageUrl {
  id: number;
  url: string;
  type?: string | null;
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

export interface Video {
  id: number;
  video_id: string;
  title: string;
  cid?: string;
  duration?: number;
  release_date?: string;
  jancode?: string;
  maker_product?: string;
  floor_code?: string;
  image_urls?: string[];
  video_image_url?: VideoImageUrl[];
  sample_image_url?: VideoVideoSampleImageUrlUrl[];
  sample_movie_url?: VideoSampleMovieUrl[];
  m3u8_urls?: string[];
  views?: number;
  likes?: number;
  dislikes?: number;
  comments?: number;
  maker?: NamedEntity | null;
  label?: NamedEntity | null;
  director?: NamedEntity | null;
  series?: NamedEntity | null;
  actresses?: ActressRef[];
  genres?: NamedEntity[];
}

export const mockVideos: Video[] = [
  {
    id: 1,
    video_id: "ABCD123",
    title: "Beautiful Day in Tokyo",
    cid: "ABC-123",
    duration: 125,
    release_date: "2024-01-15",
    jancode: "1234567890123",
    maker_product: "STUDIO-A",
    floor_code: "videoa",
    image_urls: ["https://picsum.photos/id/1015/800/450", "https://picsum.photos/id/1016/800/450"],
    sample_image_url: [
      { id: 1, url: "https://picsum.photos/id/1015/640/360", type: "sample" },
      { id: 2, url: "https://picsum.photos/id/1016/640/360", type: "sample" },
      { id: 3, url: "https://picsum.photos/id/1018/640/360", type: "sample" },
      { id: 4, url: "https://picsum.photos/id/1025/640/360", type: "sample" },
      { id: 5, url: "https://picsum.photos/id/1027/640/360", type: "sample" },
      { id: 6, url: "https://picsum.photos/id/1035/640/360", type: "sample" },
      { id: 7, url: "https://picsum.photos/id/1036/640/360", type: "sample" },
      { id: 8, url: "https://picsum.photos/id/1039/640/360", type: "sample" },
      { id: 9, url: "https://picsum.photos/id/1043/640/360", type: "sample" },
      { id: 10, url: "https://picsum.photos/id/1044/640/360", type: "sample" },
    ],
    m3u8_urls: ["https://example.com/video1.m3u8"],
    sample_movie_url: [
      { id: 1, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 2933,
    likes: 127,
    comments: 14,
    maker: { id: 1, name: "STUDIO-A" },
    label: { id: 1, name: "Velvet Soft" },
    director: { id: 1, name: "Kenji Morita" },
    series: { id: 1, name: "Velvet Chronicle" },
    actresses: [
      { id: 1, name: "Aoi Tsukasa", image_url: "https://picsum.photos/id/11/160/160" },
      { id: 8, name: "Ena Satsuki", image_url: "https://picsum.photos/id/18/160/160" },
    ],
    genres: [
      { id: 1, name: "Drama" },
      { id: 2, name: "Romance" },
      { id: 3, name: "Thriller" },
      { id: 4, name: "Adventure" },
      { id: 5, name: "Comedy" },
      { id: 6, name: "Office" },
      { id: 7, name: "Horror" },
      { id: 8, name: "Family" },
      { id: 9, name: "Slice of Life" },
      { id: 10, name: "Ensemble" },
      { id: 11, name: "Seasonal" },
      { id: 12, name: "Action" },
    ],
  },
  {
    id: 2,
    video_id: "EFGH456",
    title: "Midnight Secret",
    cid: "EFG-456",
    duration: 98,
    release_date: "2024-02-20",
    jancode: "9876543210987",
    maker_product: "DREAM-STUDIO",
    floor_code: "videob",
    image_urls: ["https://picsum.photos/id/1027/800/450"],
    m3u8_urls: ["https://example.com/video2.m3u8"],
    sample_movie_url: [
      { id: 2, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 4666,
    likes: 174,
    comments: 23,
    maker: { id: 2, name: "DREAM-STUDIO" },
    label: { id: 2, name: "Night Pulse" },
    director: { id: 2, name: "Aya Fujimoto" },
    series: { id: 2, name: "Night Pulse Arc" },
    actresses: [
      { id: 4, name: "Yua Mikami", image_url: "https://picsum.photos/id/14/160/160" },
      { id: 11, name: "Minami Aizawa", image_url: "https://picsum.photos/id/21/160/160" },
      { id: 18, name: "Rion", image_url: "https://picsum.photos/id/28/160/160" },
    ],
    genres: [
      { id: 3, name: "Thriller" },
      { id: 2, name: "Romance" },
    ],
  },
  {
    id: 3,
    video_id: "IJKL789",
    title: "Summer Adventure",
    cid: "IJK-789",
    duration: 142,
    release_date: "2024-03-10",
    maker_product: "HORIZON-FILMS",
    floor_code: "videoc",
    image_urls: ["https://picsum.photos/id/106/800/450", "https://picsum.photos/id/107/800/450"],
    sample_movie_url: [
      { id: 3, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 6399,
    likes: 221,
    comments: 32,
    maker: { id: 3, name: "HORIZON-FILMS" },
    label: null,
    director: { id: 3, name: "Ryo Tanaka" },
    series: { id: 1, name: "Velvet Chronicle" },
    actresses: [
      { id: 7, name: "Saika Kawakita", image_url: "https://picsum.photos/id/17/160/160" },
      { id: 14, name: "Julia", image_url: "https://picsum.photos/id/24/160/160" },
      { id: 21, name: "Asuka Kirara", image_url: "https://picsum.photos/id/31/160/160" },
      { id: 28, name: "Aika Yumeno", image_url: "https://picsum.photos/id/38/160/160" },
    ],
    genres: [
      { id: 1, name: "Drama" },
      { id: 2, name: "Romance" },
      { id: 3, name: "Thriller" },
      { id: 4, name: "Adventure" },
      { id: 5, name: "Comedy" },
      { id: 6, name: "Office" },
      { id: 7, name: "Horror" },
      { id: 8, name: "Family" },
      { id: 9, name: "Slice of Life" },
      { id: 10, name: "Ensemble" },
      { id: 11, name: "Seasonal" },
      { id: 12, name: "Action" },
    ],
  },
  {
    id: 4,
    video_id: "MNOP012",
    title: "Forbidden Love",
    cid: "MNO-012",
    duration: 87,
    release_date: "2024-04-05",
    jancode: "1112223334445",
    image_urls: ["https://picsum.photos/id/201/800/450"],
    sample_movie_url: [
      { id: 4, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 8132,
    likes: 268,
    comments: 41,
    maker: { id: 1, name: "STUDIO-A" },
    label: { id: 3, name: "Cherry Line" },
    director: null,
    actresses: [
      { id: 10, name: "Miku Ohashi", image_url: "https://picsum.photos/id/20/160/160" },
      { id: 17, name: "Ai Uehara", image_url: "https://picsum.photos/id/27/160/160" },
      { id: 24, name: "Honoka Mihara", image_url: "https://picsum.photos/id/34/160/160" },
      { id: 31, name: "Yuria Satomi", image_url: "https://picsum.photos/id/41/160/160" },
      { id: 38, name: "Remu Suzumori", image_url: "https://picsum.photos/id/48/160/160" },
    ],
    genres: [{ id: 2, name: "Romance" }],
  },
  {
    id: 5,
    video_id: "QRST345",
    title: "Corporate Affair",
    cid: "QRS-345",
    duration: 115,
    release_date: "2024-05-12",
    maker_product: "PREMIUM-LINE",
    image_urls: ["https://picsum.photos/id/208/800/450"],
    sample_movie_url: [
      { id: 5, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 9865,
    likes: 315,
    comments: 50,
    maker: { id: 4, name: "PREMIUM-LINE" },
    label: { id: 1, name: "Velvet Soft" },
    director: { id: 1, name: "Kenji Morita" },
    actresses: [
      { id: 13, name: "Tsubomi", image_url: "https://picsum.photos/id/23/160/160" },
      { id: 20, name: "Akiho Yoshizawa", image_url: "https://picsum.photos/id/30/160/160" },
    ],
    genres: [
      { id: 1, name: "Drama" },
      { id: 6, name: "Office" },
    ],
  },
  {
    id: 6,
    video_id: "UVWX678",
    title: "Haunted Mansion",
    cid: "UVW-678",
    duration: 132,
    release_date: "2024-06-18",
    floor_code: "videod",
    image_urls: ["https://picsum.photos/id/301/800/450"],
    sample_movie_url: [
      { id: 6, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 11598,
    likes: 362,
    comments: 59,
    maker: { id: 5, name: "SHADOW-HOUSE" },
    label: null,
    director: { id: 4, name: "Mika Sato" },
    actresses: [
      { id: 16, name: "Anri Okita", image_url: "https://picsum.photos/id/26/160/160" },
      { id: 23, name: "Sola Aoi", image_url: "https://picsum.photos/id/33/160/160" },
      { id: 30, name: "Moko Sakura", image_url: "https://picsum.photos/id/40/160/160" },
    ],
    genres: [
      { id: 7, name: "Horror" },
      { id: 3, name: "Thriller" },
    ],
  },
  {
    id: 7,
    video_id: "YZAB901",
    title: "Beach Paradise",
    cid: "YZA-901",
    duration: 76,
    release_date: "2024-07-22",
    maker_product: "SUNSHINE-PROD",
    image_urls: ["https://picsum.photos/id/367/800/450"],
    sample_movie_url: [
      { id: 7, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 13331,
    likes: 409,
    comments: 68,
    maker: { id: 6, name: "SUNSHINE-PROD" },
    label: { id: 4, name: "Summer Wave" },
    director: { id: 2, name: "Aya Fujimoto" },
    actresses: [
      { id: 19, name: "Shoko Takahashi", image_url: "https://picsum.photos/id/29/160/160" },
      { id: 26, name: "Minami Hatsukawa", image_url: "https://picsum.photos/id/36/160/160" },
      { id: 33, name: "Eimi Fukada", image_url: "https://picsum.photos/id/43/160/160" },
      { id: 40, name: "Kaori Saejima", image_url: "https://picsum.photos/id/50/160/160" },
    ],
    genres: [{ id: 5, name: "Comedy" }],
  },
  {
    id: 8,
    video_id: "CDEF234",
    title: "Office Romance",
    cid: "CDE-234",
    duration: 108,
    release_date: "2024-08-08",
    image_urls: ["https://picsum.photos/id/433/800/450"],
    sample_movie_url: [
      { id: 8, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 15064,
    likes: 456,
    comments: 77,
    maker: { id: 4, name: "PREMIUM-LINE" },
    label: { id: 2, name: "Night Pulse" },
    director: { id: 3, name: "Ryo Tanaka" },
    actresses: [
      { id: 22, name: "Maria Ozawa", image_url: "https://picsum.photos/id/32/160/160" },
      { id: 29, name: "Ruka Inaba", image_url: "https://picsum.photos/id/39/160/160" },
      { id: 36, name: "Mio Kimijima", image_url: "https://picsum.photos/id/46/160/160" },
      { id: 43, name: "Yui Nishikawa", image_url: "https://picsum.photos/id/53/160/160" },
      { id: 50, name: "Aya Sazanami", image_url: "https://picsum.photos/id/60/160/160" },
    ],
    genres: [
      { id: 6, name: "Office" },
      { id: 2, name: "Romance" },
    ],
  },
  {
    id: 9,
    video_id: "GHIJ567",
    title: "Night Drive",
    cid: "GHI-567",
    duration: 94,
    release_date: "2024-09-14",
    maker_product: "NIGHT-RIDER",
    image_urls: ["https://picsum.photos/id/1018/800/450"],
    sample_movie_url: [
      { id: 9, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 16797,
    likes: 503,
    comments: 86,
    maker: { id: 7, name: "NIGHT-RIDER" },
    label: null,
    director: null,
    actresses: [
      { id: 25, name: "Yume Nishino", image_url: "https://picsum.photos/id/35/160/160" },
      { id: 32, name: "Ameri Ichinose", image_url: "https://picsum.photos/id/42/160/160" },
    ],
    genres: [{ id: 3, name: "Thriller" }],
  },
  {
    id: 10,
    video_id: "KLMN890",
    title: "Family Reunion",
    cid: "KLM-890",
    duration: 156,
    release_date: "2024-10-01",
    jancode: "5556667778889",
    image_urls: ["https://picsum.photos/id/1060/800/450"],
    sample_image_url: [
      { id: 1101, url: "https://picsum.photos/id/1015/640/360", type: "sample" },
      { id: 1102, url: "https://picsum.photos/id/1016/640/360", type: "sample" },
      { id: 1103, url: "https://picsum.photos/id/1018/640/360", type: "sample" },
      { id: 1104, url: "https://picsum.photos/id/1025/640/360", type: "sample" },
      { id: 1105, url: "https://picsum.photos/id/1027/640/360", type: "sample" },
      { id: 1106, url: "https://picsum.photos/id/1035/640/360", type: "sample" },
      { id: 1107, url: "https://picsum.photos/id/1036/640/360", type: "sample" },
      { id: 1108, url: "https://picsum.photos/id/1039/640/360", type: "sample" },
      { id: 1109, url: "https://picsum.photos/id/1043/640/360", type: "sample" },
      { id: 11010, url: "https://picsum.photos/id/1044/640/360", type: "sample" },
    ],
    sample_movie_url: [
      { id: 10, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 18530,
    likes: 550,
    comments: 95,
    maker: { id: 1, name: "STUDIO-A" },
    label: { id: 1, name: "Velvet Soft" },
    director: { id: 1, name: "Kenji Morita" },
    actresses: [
      { id: 28, name: "Aika Yumeno", image_url: "https://picsum.photos/id/38/160/160" },
      { id: 35, name: "Himari Kinoshita", image_url: "https://picsum.photos/id/45/160/160" },
      { id: 42, name: "Shinoda Ayumi", image_url: "https://picsum.photos/id/52/160/160" },
    ],
    genres: [
      { id: 1, name: "Drama" },
      { id: 2, name: "Romance" },
      { id: 3, name: "Thriller" },
      { id: 4, name: "Adventure" },
      { id: 5, name: "Comedy" },
      { id: 6, name: "Office" },
      { id: 7, name: "Horror" },
      { id: 8, name: "Family" },
      { id: 9, name: "Slice of Life" },
      { id: 10, name: "Ensemble" },
      { id: 11, name: "Seasonal" },
      { id: 12, name: "Action" },
    ],
  },
  {
    id: 11,
    video_id: "OPQR111",
    title: "City Lights",
    cid: "OPQ-111",
    duration: 101,
    release_date: "2024-11-05",
    maker_product: "NEON-WORKS",
    image_urls: ["https://picsum.photos/id/129/800/450"],
    sample_movie_url: [
      { id: 11, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 20263,
    likes: 597,
    comments: 104,
    maker: { id: 8, name: "NEON-WORKS" },
    label: { id: 5, name: "Urban Glow" },
    director: { id: 4, name: "Mika Sato" },
    actresses: [
      { id: 31, name: "Yuria Satomi", image_url: "https://picsum.photos/id/41/160/160" },
      { id: 38, name: "Remu Suzumori", image_url: "https://picsum.photos/id/48/160/160" },
      { id: 45, name: "Riko Honda", image_url: "https://picsum.photos/id/55/160/160" },
      { id: 52, name: "Nanami Misaki", image_url: "https://picsum.photos/id/62/160/160" },
    ],
    genres: [{ id: 1, name: "Drama" }],
  },
  {
    id: 12,
    video_id: "STUV222",
    title: "Rainy Season",
    cid: "STU-222",
    duration: 119,
    release_date: "2024-12-12",
    image_urls: ["https://picsum.photos/id/137/800/450"],
    sample_movie_url: [
      { id: 12, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 21996,
    likes: 644,
    comments: 113,
    maker: null,
    label: { id: 3, name: "Cherry Line" },
    director: { id: 2, name: "Aya Fujimoto" },
    actresses: [
      { id: 34, name: "Yua Saki", image_url: "https://picsum.photos/id/44/160/160" },
      { id: 41, name: "Mako Oda", image_url: "https://picsum.photos/id/51/160/160" },
      { id: 48, name: "Yuria Yoshine", image_url: "https://picsum.photos/id/58/160/160" },
      { id: 55, name: "Hana Himesaki", image_url: "https://picsum.photos/id/65/160/160" },
      { id: 62, name: "Kaho Shibuya", image_url: "https://picsum.photos/id/72/160/160" },
    ],
    genres: [],
  },
  {
    id: 13,
    video_id: "WXYZ333",
    title: "Winter Story",
    cid: "WXY-333",
    duration: 88,
    release_date: "2025-01-20",
    maker_product: "SNOW-FILM",
    image_urls: ["https://picsum.photos/id/145/800/450"],
    sample_movie_url: [
      { id: 13, url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", type: "sample" },
    ],
    views: 23729,
    likes: 691,
    comments: 122,
    maker: { id: 9, name: "SNOW-FILM" },
    label: null,
    director: null,
    actresses: [
      { id: 37, name: "Yuko Ono", image_url: "https://picsum.photos/id/47/160/160" },
      { id: 44, name: "Aoi Matsushima", image_url: "https://picsum.photos/id/54/160/160" },
    ],
    genres: [
      { id: 1, name: "Drama" },
      { id: 11, name: "Seasonal" },
    ],
  },
];

export function getMockVideoById(videoId: string): Video | undefined {
  const exact = mockVideos.find((v) => v.video_id === videoId);
  if (exact) return exact;
  const baseId = videoId.replace(/__\d+$/, "");
  if (baseId !== videoId) {
    return mockVideos.find((v) => v.video_id === baseId);
  }
  return undefined;
}

export function getMockRelatedVideos(excludeVideoId: string, limit = 12): Video[] {
  return mockVideos.filter((v) => v.video_id !== excludeVideoId).slice(0, limit);
}
