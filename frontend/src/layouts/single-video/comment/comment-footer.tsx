import { ThumbsDown, ThumbsUp } from "lucide-react";

import { formatCompactNumber, cn } from "@/libs/utils";

interface CommentFooterProps {
  likes: number;
  dislikes: number;
  initialVote?: "like" | "dislike" | null;
  onReply?: () => void;
  onVote?: (next: "like" | "dislike" | null, previous: "like" | "dislike" | null) => void;
}

export function CommentFooter({ likes, dislikes, initialVote = null, onReply, onVote }: CommentFooterProps) {
  const vote = initialVote ?? null;

  function handleLike() {
    const previous = vote;
    const next: "like" | "dislike" | null = vote === "like" ? null : "like";

    onVote?.(next, previous);
  }

  function handleDislike() {
    const previous = vote;
    const next: "like" | "dislike" | null = vote === "dislike" ? null : "dislike";

    onVote?.(next, previous);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
          vote === "like" && "text-primary hover:text-primary",
          onVote == null && "cursor-default opacity-70",
        )}
        aria-pressed={vote === "like"}
        disabled={onVote == null}
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
          onVote == null && "cursor-default opacity-70",
        )}
        aria-pressed={vote === "dislike"}
        disabled={onVote == null}
        onClick={handleDislike}
      >
        <ThumbsDown className={cn("size-3.5", vote === "dislike" && "fill-current")} />
        {formatCompactNumber(dislikes)}
      </button>

      {onReply != null ? (
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
