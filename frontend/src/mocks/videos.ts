export interface NamedEntity {
  id: number;
  name: string;
}

export interface ActressRef extends NamedEntity {
  image_url?: string;
}

/** Backend `VideoImageUrl` — thumbnails / covers (not sample review strip). */
export interface VideoImageUrl {
  id: number;
  url: string;
  type?: string | null;
}

/** Backend `VideoSampleImageUrl` — sample / review images for the gallery. */
export interface VideoSampleImageUrl {
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
  /** Thumbnails / covers (`video_image_url`) */
  image_urls?: string[];
  video_image_url?: VideoImageUrl[];
  /** Sample / review images (`video_sample_image_url`) — do not use image_urls here */
  sample_image_url?: VideoSampleImageUrl[];
  m3u8_urls?: string[];
  maker?: NamedEntity | null;
  label?: NamedEntity | null;
  director?: NamedEntity | null;
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
    maker: { id: 1, name: "STUDIO-A" },
    label: { id: 1, name: "Velvet Soft" },
    director: { id: 1, name: "Kenji Morita" },
    actresses: [
      { id: 201, name: "Yui Nagase", image_url: "https://picsum.photos/id/64/80/80" },
      { id: 202, name: "Aoi Tsukasa", image_url: "https://picsum.photos/id/65/80/80" },
      { id: 203, name: "Sora Aoi", image_url: "https://picsum.photos/id/66/80/80" },
      { id: 204, name: "Rina Ishihara", image_url: "https://picsum.photos/id/67/80/80" },
      { id: 205, name: "Yuna Ogura", image_url: "https://picsum.photos/id/68/80/80" },
      { id: 206, name: "Miku Ohashi", image_url: "https://picsum.photos/id/69/80/80" },
      { id: 207, name: "Ena Satsuki", image_url: "https://picsum.photos/id/70/80/80" },
      { id: 208, name: "Saika Kawakita", image_url: "https://picsum.photos/id/71/80/80" },
      { id: 209, name: "Kana Momonogi", image_url: "https://picsum.photos/id/72/80/80" },
      { id: 210, name: "Arina Hashimoto", image_url: "https://picsum.photos/id/73/80/80" },
      { id: 211, name: "Yua Mikami", image_url: "https://picsum.photos/id/74/80/80" },
      { id: 212, name: "Julia", image_url: "https://picsum.photos/id/75/80/80" },
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
    maker: { id: 2, name: "DREAM-STUDIO" },
    label: { id: 2, name: "Night Pulse" },
    director: { id: 2, name: "Aya Fujimoto" },
    actresses: [{ id: 102, name: "Aoi Tsukasa", image_url: "https://picsum.photos/id/65/80/80" }],
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
    maker: { id: 3, name: "HORIZON-FILMS" },
    label: null,
    director: { id: 3, name: "Ryo Tanaka" },
    actresses: [
      { id: 201, name: "Yui Nagase", image_url: "https://picsum.photos/id/64/80/80" },
      { id: 202, name: "Aoi Tsukasa", image_url: "https://picsum.photos/id/65/80/80" },
      { id: 203, name: "Sora Aoi", image_url: "https://picsum.photos/id/66/80/80" },
      { id: 204, name: "Rina Ishihara", image_url: "https://picsum.photos/id/67/80/80" },
      { id: 205, name: "Yuna Ogura", image_url: "https://picsum.photos/id/68/80/80" },
      { id: 206, name: "Miku Ohashi", image_url: "https://picsum.photos/id/69/80/80" },
      { id: 207, name: "Ena Satsuki", image_url: "https://picsum.photos/id/70/80/80" },
      { id: 208, name: "Saika Kawakita", image_url: "https://picsum.photos/id/71/80/80" },
      { id: 209, name: "Kana Momonogi", image_url: "https://picsum.photos/id/72/80/80" },
      { id: 210, name: "Arina Hashimoto", image_url: "https://picsum.photos/id/73/80/80" },
      { id: 211, name: "Yua Mikami", image_url: "https://picsum.photos/id/74/80/80" },
      { id: 212, name: "Julia", image_url: "https://picsum.photos/id/75/80/80" },
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
    maker: { id: 1, name: "STUDIO-A" },
    label: { id: 3, name: "Cherry Line" },
    director: null,
    actresses: [{ id: 105, name: "Yuna Ogura", image_url: "https://picsum.photos/id/68/80/80" }],
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
    maker: { id: 4, name: "PREMIUM-LINE" },
    label: { id: 1, name: "Velvet Soft" },
    director: { id: 1, name: "Kenji Morita" },
    actresses: [{ id: 106, name: "Miku Ohashi", image_url: "https://picsum.photos/id/69/80/80" }],
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
    maker: { id: 5, name: "SHADOW-HOUSE" },
    label: null,
    director: { id: 4, name: "Mika Sato" },
    actresses: [{ id: 107, name: "Ena Satsuki", image_url: "https://picsum.photos/id/70/80/80" }],
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
    maker: { id: 6, name: "SUNSHINE-PROD" },
    label: { id: 4, name: "Summer Wave" },
    director: { id: 2, name: "Aya Fujimoto" },
    actresses: [{ id: 108, name: "Saika Kawakita", image_url: "https://picsum.photos/id/71/80/80" }],
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
    maker: { id: 4, name: "PREMIUM-LINE" },
    label: { id: 2, name: "Night Pulse" },
    director: { id: 3, name: "Ryo Tanaka" },
    actresses: [{ id: 109, name: "Kana Momonogi", image_url: "https://picsum.photos/id/72/80/80" }],
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
    maker: { id: 7, name: "NIGHT-RIDER" },
    label: null,
    director: null,
    actresses: [{ id: 110, name: "Arina Hashimoto", image_url: "https://picsum.photos/id/73/80/80" }],
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
    maker: { id: 1, name: "STUDIO-A" },
    label: { id: 1, name: "Velvet Soft" },
    director: { id: 1, name: "Kenji Morita" },
    actresses: [
      { id: 201, name: "Yui Nagase", image_url: "https://picsum.photos/id/64/80/80" },
      { id: 202, name: "Aoi Tsukasa", image_url: "https://picsum.photos/id/65/80/80" },
      { id: 203, name: "Sora Aoi", image_url: "https://picsum.photos/id/66/80/80" },
      { id: 204, name: "Rina Ishihara", image_url: "https://picsum.photos/id/67/80/80" },
      { id: 205, name: "Yuna Ogura", image_url: "https://picsum.photos/id/68/80/80" },
      { id: 206, name: "Miku Ohashi", image_url: "https://picsum.photos/id/69/80/80" },
      { id: 207, name: "Ena Satsuki", image_url: "https://picsum.photos/id/70/80/80" },
      { id: 208, name: "Saika Kawakita", image_url: "https://picsum.photos/id/71/80/80" },
      { id: 209, name: "Kana Momonogi", image_url: "https://picsum.photos/id/72/80/80" },
      { id: 210, name: "Arina Hashimoto", image_url: "https://picsum.photos/id/73/80/80" },
      { id: 211, name: "Yua Mikami", image_url: "https://picsum.photos/id/74/80/80" },
      { id: 212, name: "Julia", image_url: "https://picsum.photos/id/75/80/80" },
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
    maker: { id: 8, name: "NEON-WORKS" },
    label: { id: 5, name: "Urban Glow" },
    director: { id: 4, name: "Mika Sato" },
    actresses: [{ id: 113, name: "Minami Aizawa", image_url: "https://picsum.photos/id/76/80/80" }],
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
    maker: null,
    label: { id: 3, name: "Cherry Line" },
    director: { id: 2, name: "Aya Fujimoto" },
    actresses: [{ id: 114, name: "Hibiki Otsuki", image_url: "https://picsum.photos/id/77/80/80" }],
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
    maker: { id: 9, name: "SNOW-FILM" },
    label: null,
    director: null,
    actresses: [{ id: 115, name: "Tsubomi", image_url: "https://picsum.photos/id/78/80/80" }],
    genres: [
      { id: 1, name: "Drama" },
      { id: 11, name: "Seasonal" },
    ],
  },
];

export function getMockVideoById(videoId: string): Video | undefined {
  return mockVideos.find((v) => v.video_id === videoId);
}

export function getMockRelatedVideos(excludeVideoId: string, limit = 12): Video[] {
  return mockVideos.filter((v) => v.video_id !== excludeVideoId).slice(0, limit);
}
