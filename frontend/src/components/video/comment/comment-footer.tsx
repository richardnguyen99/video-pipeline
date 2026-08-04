import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { formatCompactNumber, cn } from "@/libs/utils";

interface CommentFooterProps {
  likes: number;
  dislikes: number;
  initialVote?: "like" | "dislike" | null;
  onReply?: () => void;
}

export function CommentFooter({
  likes: initialLikes,
  dislikes: initialDislikes,
  initialVote = null,
  onReply,
}: CommentFooterProps) {
  const [vote, setVote] = useState<"like" | "dislike" | null>(initialVote);
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);

  function handleLike() {
    if (vote === "like") {
      setVote(null);
      setLikes((n) => n - 1);
      return;
    }
    if (vote === "dislike") setDislikes((n) => n - 1);
    setVote("like");
    setLikes((n) => n + 1);
  }

  function handleDislike() {
    if (vote === "dislike") {
      setVote(null);
      setDislikes((n) => n - 1);
      return;
    }
    if (vote === "like") setLikes((n) => n - 1);
    setVote("dislike");
    setDislikes((n) => n + 1);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
          vote === "like" && "text-primary hover:text-primary",
        )}
        aria-pressed={vote === "like"}
        onClick={handleLike}
      >
        <ThumbsUp className={cn("size-3.5", vote === "like" && "fill-current")} />
        {formatCompactNumber(likes)}
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
          vote === "dislike" && "text-primary hover:text-primary",
        )}
        aria-pressed={vote === "dislike"}
        onClick={handleDislike}
      >
        <ThumbsDown className={cn("size-3.5", vote === "dislike" && "fill-current")} />
        {formatCompactNumber(dislikes)}
      </button>
      {onReply ? (
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onReply}
        >
          Reply
        </button>
      ) : null}
    </div>
  );
}
