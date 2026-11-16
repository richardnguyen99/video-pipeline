import { Quote } from "lucide-react";

import type { CommentUser } from "@/queries/comments";
import { cn, formatRelativeDate } from "@/libs/utils";

import { CommentMoreMenu } from "./comment-more-menu";

interface CommentHeaderProps {
  user: CommentUser;
  createdAt: string;
  isEdited: boolean;
  isOwner: boolean;
  isDeleted?: boolean;
  showAvatar?: boolean;
  onQuote?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  className?: string;
}

export function CommentHeader({
  user,
  createdAt,
  isEdited,
  isOwner,
  isDeleted = false,
  showAvatar = true,
  onQuote,
  onEdit,
  onDelete,
  onReport,
  className,
}: CommentHeaderProps) {
  const displayName = isDeleted ? "Deleted" : user.display_name?.trim() || user.username;
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className={cn("flex items-start justify-between gap-2", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {showAvatar ? (
          <span className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
            {!isDeleted && user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="size-full object-cover"
                width={36}
                height={36}
                loading="lazy"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
                {isDeleted ? "?" : initial}
              </span>
            )}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cn("truncate text-sm font-semibold", isDeleted && "italic text-muted-foreground")}>
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground">{formatRelativeDate(createdAt)}</span>
            {!isDeleted && isEdited ? <span className="text-xs text-muted-foreground">(edited)</span> : null}
          </div>
        </div>
      </div>

      {!isDeleted ? (
        <div className="flex shrink-0 items-center gap-0.5">
          {onQuote ? (
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Quote comment"
              onClick={onQuote}
            >
              <Quote className="size-4" />
            </button>
          ) : null}
          <CommentMoreMenu isOwner={isOwner} onEdit={onEdit} onDelete={onDelete} onReport={onReport} />
        </div>
      ) : null}
    </div>
  );
}
