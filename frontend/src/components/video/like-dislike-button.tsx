import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { cn } from "@/libs/utils";

import { VideoActionButton } from "./video-action-button";

interface LikeDislikeButtonsProps {
  isAuthenticated: boolean;
}

export function LikeDislikeButtons({ isAuthenticated }: LikeDislikeButtonsProps) {
  const [liked, setLiked] = useState<"like" | "dislike" | null>(null);

  const isLiked = liked === "like";
  const isDisliked = liked === "dislike";

  const likeTooltip = isAuthenticated ? "I like this" : "Log in to like/dislike this video";
  const dislikeTooltip = isAuthenticated ? "I don't like this" : "Log in to like/dislike this video";

  function handleLike() {
    if (!isAuthenticated) return;
    setLiked((value) => (value === "like" ? null : "like"));
  }

  function handleDislike() {
    if (!isAuthenticated) return;
    setLiked((value) => (value === "dislike" ? null : "dislike"));
  }

  return (
    <div className="flex overflow-hidden rounded-lg bg-secondary">
      <VideoActionButton
        tooltip={likeTooltip}
        variant="ghost"
        className={cn(
          "rounded-none rounded-l-lg border-0 bg-transparent text-secondary-foreground",
          !isLiked && "hover:bg-secondary/80 hover:text-secondary-foreground",
          isLiked && "text-primary hover:text-primary-active",
        )}
        onClick={handleLike}
      >
        <ThumbsUp className="size-4" fill={isLiked ? "currentColor" : "none"} strokeWidth={isLiked ? 0 : 2} />
        <span className="hidden sm:inline">Like</span>
      </VideoActionButton>

      <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />

      <VideoActionButton
        tooltip={dislikeTooltip}
        variant="ghost"
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
