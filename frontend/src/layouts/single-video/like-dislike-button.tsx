import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { toast } from "@/components/ui/toast";
import { getApiErrorMessage } from "@/libs/auth";
import { cn } from "@/libs/utils";
import {
  clearVideoReaction,
  setVideoReaction,
  videoReactionQueryKeys,
  videoReactionQueryOptions,
} from "@/queries/video-reaction";
import type { VideoReactionResponse } from "@/queries/video-reaction";
import { useAuthStore } from "@/stores/auth-store";

import { VideoActionButton } from "./video-action-button";

type ReactionPolarity = "like" | "dislike" | null;

interface LikeDislikeButtonsProps {
  videoId: number;
  likes?: number;
  dislikes?: number;
}

function polarityFromResponse(isLike: boolean | null | undefined): ReactionPolarity {
  if (isLike === true) {
    return "like";
  }

  if (isLike === false) {
    return "dislike";
  }

  return null;
}

function applyOptimistic(previous: VideoReactionResponse, next: ReactionPolarity): VideoReactionResponse {
  const current = polarityFromResponse(previous.is_like);
  let likes = previous.likes;
  let dislikes = previous.dislikes;

  if (current === "like") {
    likes = Math.max(0, likes - 1);
  } else if (current === "dislike") {
    dislikes = Math.max(0, dislikes - 1);
  }

  if (next === "like") {
    likes += 1;
  } else if (next === "dislike") {
    dislikes += 1;
  }

  return {
    video_id: previous.video_id,
    is_like: next === "like" ? true : next === "dislike" ? false : null,
    likes,
    dislikes,
  };
}

export function LikeDislikeButtons({
  videoId,
  likes: initialLikes = 0,
  dislikes: initialDislikes = 0,
}: LikeDislikeButtonsProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const isAuthenticated = user != null;

  const reactionQuery = useQuery({
    ...videoReactionQueryOptions(videoId),
    enabled: isAuthenticated && !isRestoring,
  });

  const baseline: VideoReactionResponse = {
    video_id: videoId,
    is_like: reactionQuery.data?.is_like ?? null,
    likes: reactionQuery.data?.likes ?? initialLikes,
    dislikes: reactionQuery.data?.dislikes ?? initialDislikes,
  };

  const mutation = useMutation({
    mutationFn: async (next: ReactionPolarity) => {
      if (next === null) {
        return clearVideoReaction(videoId);
      }

      return setVideoReaction(videoId, next === "like");
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({
        queryKey: videoReactionQueryKeys.byVideo(videoId),
      });

      const previous =
        queryClient.getQueryData<VideoReactionResponse>(videoReactionQueryKeys.byVideo(videoId)) ?? baseline;

      queryClient.setQueryData(videoReactionQueryKeys.byVideo(videoId), applyOptimistic(previous, next));

      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous != null) {
        queryClient.setQueryData(videoReactionQueryKeys.byVideo(videoId), context.previous);
      }

      toast.add({
        type: "error",
        title: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(videoReactionQueryKeys.byVideo(videoId), data);
    },
  });

  const polarity = polarityFromResponse(reactionQuery.data?.is_like ?? baseline.is_like);
  const likes = reactionQuery.data?.likes ?? baseline.likes;
  const isLiked = polarity === "like";
  const isDisliked = polarity === "dislike";
  const pending = mutation.isPending;

  const likeTooltip = isAuthenticated ? "I like this" : "Log in to like/dislike this video";
  const dislikeTooltip = isAuthenticated ? "I don't like this" : "Log in to like/dislike this video";

  function handleLike() {
    if (!isAuthenticated || pending) {
      return;
    }

    const next: ReactionPolarity = polarity === "like" ? null : "like";

    mutation.mutate(next);
  }

  function handleDislike() {
    if (!isAuthenticated || pending) {
      return;
    }

    const next: ReactionPolarity = polarity === "dislike" ? null : "dislike";

    mutation.mutate(next);
  }

  return (
    <div className="flex overflow-hidden rounded-lg bg-secondary">
      <VideoActionButton
        tooltip={likeTooltip}
        variant="ghost"
        disabled={pending}
        className={cn(
          "rounded-none rounded-l-lg border-0 bg-transparent text-secondary-foreground",
          !isLiked && "hover:bg-secondary/80 hover:text-secondary-foreground",
          isLiked && "text-primary hover:text-primary-active",
        )}
        onClick={handleLike}
      >
        <ThumbsUp className="size-4" fill={isLiked ? "currentColor" : "none"} strokeWidth={isLiked ? 0 : 2} />

        <span className="hidden sm:inline">{likes > 0 ? likes.toLocaleString() : "Like"}</span>
      </VideoActionButton>

      <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />

      <VideoActionButton
        tooltip={dislikeTooltip}
        variant="ghost"
        disabled={pending}
        className={cn(
          "rounded-none rounded-r-lg border-0 bg-transparent px-3 text-secondary-foreground",
          !isDisliked && "hover:bg-secondary/80 hover:text-secondary-foreground",
          isDisliked && "text-primary hover:text-primary-active",
        )}
        onClick={handleDislike}
      >
        <ThumbsDown className="size-4" fill={isDisliked ? "currentColor" : "none"} strokeWidth={isDisliked ? 0 : 2} />
      </VideoActionButton>
    </div>
  );
}
