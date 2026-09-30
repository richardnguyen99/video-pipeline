import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { CommentUser, VideoComment } from "@/mocks/comments";
import { cn } from "@/libs/utils";

import { CommentBody } from "./comment-body";
import { CommentComposer } from "./comment-composer";
import { CommentFooter } from "./comment-footer";
import { CommentHeader } from "./comment-header";
import { CommentReplyThread } from "./comment-reply-thread";

interface CommentItemProps {
  comment: VideoComment;
  currentUser: CommentUser;
  depth?: number;
  className?: string;
}

export function CommentItem({ comment, currentUser, depth = 0, className }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [quoteText, setQuoteText] = useState<string | undefined>();
  const [isExpanded, setIsExpanded] = useState(true);

  const isOwner = comment.user.id === currentUser.id;
  const replies = comment.replies ?? [];
  const hasReplies = replies.length > 0;
  const canNest = depth < 6;
  const replyCount = countReplies(replies);
  const showThread = isExpanded && canNest && (hasReplies || isReplying);

  const initial = (comment.user.display_name ?? comment.user.username).slice(0, 1).toUpperCase();

  function handleQuote() {
    setQuoteText(comment.content);
    setIsReplying(true);
    setIsExpanded(true);
  }

  function handleReply() {
    setQuoteText(undefined);
    setIsReplying(true);
    setIsExpanded(true);
  }

  function handleToggleExpand() {
    setIsExpanded((v) => !v);
  }

  function closeComposer() {
    setIsReplying(false);
    setQuoteText(undefined);
  }

  return (
    <article className={cn(className)}>
      <div className="flex gap-2.5">
        <div className="flex w-9 shrink-0 flex-col items-center">
          <span className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
            {comment.user.avatar_url ? (
              <img
                src={comment.user.avatar_url}
                alt=""
                className="size-full object-cover"
                width={36}
                height={36}
                loading="lazy"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
                {initial}
              </span>
            )}
          </span>
          {/*
            Stem only when there are sub-comments. Reply editor alone
            (no children) must not show a trail.
          */}
          {hasReplies && showThread ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <CommentHeader
            user={comment.user}
            createdAt={comment.created_at}
            isEdited={comment.is_edited}
            isOwner={isOwner}
            showAvatar={false}
            onQuote={handleQuote}
            onEdit={isOwner ? () => undefined : undefined}
            onDelete={isOwner ? () => undefined : undefined}
            onReport={!isOwner ? () => undefined : undefined}
          />

          {isExpanded ? (
            <>
              <div className="mt-1.5">
                <CommentBody content={comment.content} isDeleted={comment.is_deleted} />
              </div>

              {!comment.is_deleted ? (
                <div className="my-1.5 flex flex-wrap items-center gap-2">
                  <CommentFooter
                    likes={comment.likes}
                    dislikes={comment.dislikes}
                    initialVote={comment.viewer_vote}
                    onReply={handleReply}
                  />
                  {hasReplies ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-expanded={isExpanded}
                      onClick={handleToggleExpand}
                    >
                      <ChevronDown className="size-3.5" />
                      Hide replies
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
              onClick={handleToggleExpand}
            >
              <ChevronRight className="size-3.5" />
              {replyCount > 0 ? `Show ${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "Show comment"}
            </button>
          )}
        </div>
      </div>

      {showThread ? (
        <div className="ml-4.5">
          {isReplying ? (
            <div className={cn("relative pl-4", hasReplies && "border-l border-border pb-5")}>
              <CommentComposer
                currentUser={currentUser}
                showAvatar={false}
                placeholder={`Reply to @${comment.user.username}…`}
                initialValue={`@${comment.user.username} `}
                quotePreview={quoteText}
                autoFocus
                onCancel={closeComposer}
                onSubmit={closeComposer}
              />
            </div>
          ) : null}

          {hasReplies ? <CommentReplyThread replies={replies} currentUser={currentUser} depth={depth} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function countReplies(replies: VideoComment[]): number {
  return replies.reduce((sum, r) => sum + 1 + countReplies(r.replies ?? []), 0);
}
