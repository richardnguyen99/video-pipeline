import type { ReactNode } from "react";

import { cn } from "@/libs/utils";

interface CommentBodyProps {
  content: string;
  isDeleted?: boolean;
  className?: string;
}

function renderWithMentions(content: string): Array<ReactNode> {
  const parts = content.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9_]+$/.test(part)) {
      return (
        <span key={i} className="font-medium text-primary">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
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
