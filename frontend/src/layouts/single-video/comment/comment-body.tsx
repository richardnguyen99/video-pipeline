import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/libs/utils";

interface CommentBodyProps {
  content: string;
  isDeleted?: boolean;
  className?: string;
}

const MENTION_PATTERN = /(@[a-zA-Z0-9_]+)/g;
const MENTION_EXACT = /^@[a-zA-Z0-9_]+$/;

function renderWithMentions(content: string): Array<ReactNode> {
  const parts = content.split(MENTION_PATTERN);

  return parts.map((part, index) => {
    if (!MENTION_EXACT.test(part)) {
      return <span key={`text-${index}`}>{part}</span>;
    }

    const username = part.slice(1);

    return (
      <Link
        key={`mention-${username}-${index}`}
        to="/u/$username"
        params={{ username }}
        className="font-semibold text-primary underline-offset-2 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {part}
      </Link>
    );
  });
}

export function CommentBody({ content, isDeleted, className }: CommentBodyProps) {
  if (isDeleted) {
    return (
      <p
        className={cn(
          "rounded-md border border-border/50 bg-muted/40 px-3 py-2.5 text-sm italic leading-relaxed text-muted-foreground",
          className,
        )}
      >
        This comment was deleted.
      </p>
    );
  }

  return (
    <p className={cn("text-sm leading-relaxed whitespace-pre-wrap wrap-break-word", className)}>
      {renderWithMentions(content)}
    </p>
  );
}
