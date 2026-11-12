import { apiFetch } from "@/libs/api-client";

export type CommentUser = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export type VideoComment = {
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
  replies?: Array<VideoComment>;
};

export type CommentCreatePayload = {
  content: string;
  parent_id?: string | null;
};

export type CommentReactionResponse = {
  comment_id: string;
  is_like: boolean | null;
  likes: number;
  dislikes: number;
};

export type CommentDeleteResponse = {
  id: string;
  is_deleted: boolean;
};

export function countComments(comments: Array<VideoComment>): number {
  let total = 0;

  for (const comment of comments) {
    if (!comment.is_deleted) {
      total += 1;
    }

    if (comment.replies != null && comment.replies.length > 0) {
      total += countComments(comment.replies);
    }
  }

  return total;
}

export async function createVideoComment(
  videoId: string | number,
  payload: CommentCreatePayload,
): Promise<VideoComment> {
  return apiFetch<VideoComment>(`/videos/${videoId}/comments`, {
    method: "POST",
    data: {
      content: payload.content,
      parent_id: payload.parent_id ?? null,
    },
  });
}

export async function deleteVideoComment(videoId: string | number, commentId: string): Promise<CommentDeleteResponse> {
  return apiFetch<CommentDeleteResponse>(`/videos/${videoId}/comments/${commentId}`, {
    method: "DELETE",
  });
}

export async function setCommentReaction(
  videoId: string | number,
  commentId: string,
  isLike: boolean,
): Promise<CommentReactionResponse> {
  return apiFetch<CommentReactionResponse>(`/videos/${videoId}/comments/${commentId}/reaction`, {
    method: "PUT",
    data: { is_like: isLike },
  });
}

export async function clearCommentReaction(
  videoId: string | number,
  commentId: string,
): Promise<CommentReactionResponse> {
  return apiFetch<CommentReactionResponse>(`/videos/${videoId}/comments/${commentId}/reaction`, {
    method: "DELETE",
  });
}
