export interface CommentUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export interface VideoComment {
  id: string;
  video_id: number;
  user: CommentUser;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  parent_id?: string | null;
  likes: number;
  dislikes: number;
  viewer_vote?: "like" | "dislike" | null;
  replies?: VideoComment[];
}

export const mockCurrentUser: CommentUser = {
  id: "user-self",
  username: "youknowwho",
  display_name: "You",
  avatar_url: "https://picsum.photos/id/64/72/72",
};

export const mockCommentsByVideoId: Record<string, VideoComment[]> = {
  ABCD123: [
    {
      id: "c1",
      video_id: 1,
      user: {
        id: "u1",
        username: "cinephile",
        avatar_url: "https://picsum.photos/id/91/72/72",
      },
      content:
        "The cinematography in the opening act is stunning. @director_fan what did you think of the color grade?",
      is_edited: false,
      is_deleted: false,
      created_at: "2026-07-20T10:00:00Z",
      updated_at: "2026-07-20T10:00:00Z",
      likes: 42,
      dislikes: 2,
      viewer_vote: null,
      replies: [
        {
          id: "c1-r1",
          video_id: 1,
          parent_id: "c1",
          user: {
            id: "u2",
            username: "director_fan",
            avatar_url: "https://picsum.photos/id/92/72/72",
          },
          content: "@cinephile Agreed — the teal/orange balance felt intentional without being overdone.",
          is_edited: true,
          is_deleted: false,
          created_at: "2026-07-20T12:30:00Z",
          updated_at: "2026-07-20T13:00:00Z",
          likes: 11,
          dislikes: 0,
          viewer_vote: "like",
          replies: [
            {
              id: "c1-r1-r1",
              video_id: 1,
              parent_id: "c1-r1",
              user: {
                id: "u1",
                username: "cinephile",
                avatar_url: "https://picsum.photos/id/91/72/72",
              },
              content: "@director_fan Exactly. Small details like that make rewatches worth it.",
              is_edited: false,
              is_deleted: false,
              created_at: "2026-07-21T09:15:00Z",
              updated_at: "2026-07-21T09:15:00Z",
              likes: 3,
              dislikes: 0,
            },
          ],
        },
        {
          id: "c1-r2",
          video_id: 1,
          parent_id: "c1",
          user: {
            id: "user-self",
            username: "youknowwho",
            avatar_url: "https://picsum.photos/id/64/72/72",
          },
          content: "Bookmarking this thread for later.",
          is_edited: false,
          is_deleted: false,
          created_at: "2026-07-22T08:00:00Z",
          updated_at: "2026-07-22T08:00:00Z",
          likes: 1,
          dislikes: 0,
        },
      ],
    },
    {
      id: "c2",
      video_id: 1,
      user: {
        id: "u3",
        username: "nightowl",
        avatar_url: "https://picsum.photos/id/93/72/72",
      },
      content: "Sound design around 00:42 is underrated. Headphones recommended.",
      is_edited: false,
      is_deleted: false,
      created_at: "2026-07-18T18:40:00Z",
      updated_at: "2026-07-18T18:40:00Z",
      likes: 28,
      dislikes: 1,
      replies: [],
    },
    {
      id: "c3",
      video_id: 1,
      user: {
        id: "user-self",
        username: "youknowwho",
        avatar_url: "https://picsum.photos/id/64/72/72",
      },
      content: "First time watching — the pacing in the middle act surprised me.",
      is_edited: true,
      is_deleted: false,
      created_at: "2026-07-15T14:20:00Z",
      updated_at: "2026-07-16T11:00:00Z",
      likes: 7,
      dislikes: 0,
      replies: [],
    },
  ],
};

export function getMockComments(videoId: string): VideoComment[] {
  return mockCommentsByVideoId[videoId] ?? [];
}

export function countComments(comments: VideoComment[]): number {
  return comments.reduce((sum, c) => sum + 1 + countComments(c.replies ?? []), 0);
}
