import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/libs/auth";
import {
  countComments,
  createVideoComment,
  deleteVideoComment,
  filterVisibleComments,
  setCommentReaction,
  clearCommentReaction,
} from "@/queries/comments";
import type { CommentUser, VideoComment } from "@/queries/comments";
import { videoDetailQueryKey } from "@/queries/videos";
import { useAuthStore } from "@/stores/auth-store";
import type { Video } from "@/types/video";

import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

interface VideoCommentsProps {
  comments: Array<VideoComment>;
  videoId: string;
}

function toCommentUser(
  user: { id: string; username: string; display_name?: string | null } | null,
): CommentUser | null {
  if (user == null) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name ?? null,
    avatar_url: null,
  };
}

function mapCommentsWithUpdate(
  comments: Array<VideoComment>,
  commentId: string,
  updater: (comment: VideoComment) => VideoComment,
): Array<VideoComment> {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return updater(comment);
    }

    if (comment.replies != null && comment.replies.length > 0) {
      return {
        ...comment,
        replies: mapCommentsWithUpdate(comment.replies, commentId, updater),
      };
    }

    return comment;
  });
}

function insertReply(comments: Array<VideoComment>, parentId: string, reply: VideoComment): Array<VideoComment> {
  return comments.map((comment) => {
    if (comment.id === parentId) {
      return {
        ...comment,
        replies: [...(comment.replies ?? []), reply],
      };
    }

    if (comment.replies != null && comment.replies.length > 0) {
      return {
        ...comment,
        replies: insertReply(comment.replies, parentId, reply),
      };
    }

    return comment;
  });
}

function removeComment(comments: Array<VideoComment>, commentId: string): Array<VideoComment> {
  const next: Array<VideoComment> = [];

  for (const comment of comments) {
    if (comment.id === commentId) {
      if (comment.replies != null && comment.replies.length > 0) {
        next.push(...comment.replies);
      }

      continue;
    }

    next.push({
      ...comment,
      replies: comment.replies != null && comment.replies.length > 0 ? removeComment(comment.replies, commentId) : [],
    });
  }

  return next;
}

export function VideoComments({ comments, videoId }: VideoCommentsProps) {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentUser = toCommentUser(authUser);
  const visibleComments = filterVisibleComments(comments);
  const total = countComments(visibleComments);

  const detailKey = videoDetailQueryKey(videoId);

  const createMutation = useMutation({
    mutationFn: (input: { content: string; parent_id?: string | null }) => createVideoComment(videoId, input),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<Video>(detailKey, (current) => {
        if (current == null) {
          return current;
        }

        const existing = current.comment_tree ?? [];
        const nextTree = variables.parent_id
          ? insertReply(existing, variables.parent_id, created)
          : [...existing, created];

        return {
          ...current,
          comment_tree: nextTree,
          comments: (current.comments ?? 0) + 1,
        };
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteVideoComment(videoId, commentId),
    onSuccess: (_result, commentId) => {
      queryClient.setQueryData<Video>(detailKey, (current) => {
        if (current == null) {
          return current;
        }

        const existing = current.comment_tree ?? [];

        return {
          ...current,
          comment_tree: removeComment(existing, commentId),
          comments: Math.max(0, (current.comments ?? 0) - 1),
        };
      });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async (input: {
      commentId: string;
      next: "like" | "dislike" | null;
      previous: "like" | "dislike" | null;
    }) => {
      if (input.next == null) {
        return clearCommentReaction(videoId, input.commentId);
      }

      return setCommentReaction(videoId, input.commentId, input.next === "like");
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Video>(detailKey, (current) => {
        if (current == null) {
          return current;
        }

        const existing = current.comment_tree ?? [];
        const vote = result.is_like === true ? "like" : result.is_like === false ? "dislike" : null;

        return {
          ...current,
          comment_tree: mapCommentsWithUpdate(existing, variables.commentId, (comment) => ({
            ...comment,
            likes: result.likes,
            dislikes: result.dislikes,
            viewer_vote: vote,
          })),
        };
      });
    },
  });

  const createError = createMutation.error ? getApiErrorMessage(createMutation.error) : null;

  return (
    <section className="mt-10" aria-label="Comments">
      <h3 className="mb-4 text-lg font-semibold">
        {total} {total === 1 ? "Comment" : "Comments"}
      </h3>

      {currentUser != null ? (
        <CommentComposer
          currentUser={currentUser}
          className="mb-8"
          onSubmit={(content) => {
            createMutation.mutate({ content });
          }}
        />
      ) : (
        <div className="mb-8 flex flex-col gap-2 rounded-lg border border-dashed p-4">
          <p className="text-sm text-muted-foreground">Sign in to join the conversation.</p>

          <Button
            type="button"
            size="sm"
            className="w-fit"
            nativeButton={false}
            render={<Link to="/sign-in" search={{ redirect: `/videos/${videoId}` }} />}
          >
            Sign in
          </Button>
        </div>
      )}

      {createError != null ? <p className="mb-4 text-sm text-destructive">{createError}</p> : null}

      <div className="space-y-8">
        {visibleComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUser={currentUser}
            onReply={
              currentUser != null
                ? (parentId, content) => {
                    createMutation.mutate({ content, parent_id: parentId });
                  }
                : undefined
            }
            onDelete={
              currentUser != null
                ? (commentId) => {
                    deleteMutation.mutate(commentId);
                  }
                : undefined
            }
            onVote={
              currentUser != null
                ? (commentId, next, previous) => {
                    reactionMutation.mutate({ commentId, next, previous });
                  }
                : undefined
            }
          />
        ))}
      </div>

      {visibleComments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to share your thoughts.</p>
      ) : null}
    </section>
  );
}
