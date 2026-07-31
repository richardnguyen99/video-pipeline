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
  sample_image_urls?: string[];
  m3u8_urls?: string[];
  actresses?: Array<{ id: number; name: string }>;
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
    sample_image_urls: [
      "https://picsum.photos/id/102/400/225",
      "https://picsum.photos/id/103/400/225",
      "https://picsum.photos/id/104/400/225",
    ],
    m3u8_urls: ["https://example.com/video1.m3u8"],
    actresses: [{ id: 101, name: "Yui Nagase" }],
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
    sample_image_urls: ["https://picsum.photos/id/110/400/225", "https://picsum.photos/id/111/400/225"],
    m3u8_urls: ["https://example.com/video2.m3u8"],
    actresses: [{ id: 102, name: "Aoi Tsukasa" }],
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
    sample_image_urls: ["https://picsum.photos/id/112/400/225"],
    actresses: [
      { id: 103, name: "Sora Aoi" },
      { id: 104, name: "Rina Ishihara" },
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
    sample_image_urls: ["https://picsum.photos/id/113/400/225", "https://picsum.photos/id/114/400/225"],
    actresses: [{ id: 105, name: "Yuna Ogura" }],
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
    sample_image_urls: ["https://picsum.photos/id/115/400/225"],
    actresses: [{ id: 106, name: "Miku Ohashi" }],
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
    sample_image_urls: ["https://picsum.photos/id/116/400/225", "https://picsum.photos/id/117/400/225"],
    actresses: [{ id: 107, name: "Ena Satsuki" }],
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
    sample_image_urls: ["https://picsum.photos/id/118/400/225"],
    actresses: [{ id: 108, name: "Saika Kawakita" }],
  },
  {
    id: 8,
    video_id: "CDEF234",
    title: "Office Romance",
    cid: "CDE-234",
    duration: 108,
    release_date: "2024-08-08",
    image_urls: ["https://picsum.photos/id/433/800/450"],
    sample_image_urls: ["https://picsum.photos/id/119/400/225", "https://picsum.photos/id/120/400/225"],
    actresses: [{ id: 109, name: "Kana Momonogi" }],
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
    sample_image_urls: ["https://picsum.photos/id/121/400/225"],
    actresses: [{ id: 110, name: "Arina Hashimoto" }],
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
    sample_image_urls: [
      "https://picsum.photos/id/122/400/225",
      "https://picsum.photos/id/123/400/225",
      "https://picsum.photos/id/124/400/225",
    ],
    actresses: [
      { id: 111, name: "Yua Mikami" },
      { id: 112, name: "Julia" },
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
    sample_image_urls: ["https://picsum.photos/id/125/400/225"],
    actresses: [{ id: 113, name: "Minami Aizawa" }],
  },
  {
    id: 12,
    video_id: "STUV222",
    title: "Rainy Season",
    cid: "STU-222",
    duration: 119,
    release_date: "2024-12-12",
    image_urls: ["https://picsum.photos/id/137/800/450"],
    sample_image_urls: ["https://picsum.photos/id/126/400/225", "https://picsum.photos/id/128/400/225"],
    actresses: [{ id: 114, name: "Hibiki Otsuki" }],
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
    sample_image_urls: ["https://picsum.photos/id/130/400/225"],
    actresses: [{ id: 115, name: "Tsubomi" }],
  },
];

export function getMockVideoById(videoId: string): Video | undefined {
  return mockVideos.find((v) => v.video_id === videoId);
}

export function getMockRelatedVideos(excludeVideoId: string, limit = 12): Video[] {
  return mockVideos.filter((v) => v.video_id !== excludeVideoId).slice(0, limit);
}
