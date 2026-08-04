import type { ReactNode } from "react";

import { cn } from "@/libs/utils";

interface CommentBodyProps {
  content: string;
  isDeleted?: boolean;
  className?: string;
}

function renderWithMentions(content: string): ReactNode[] {
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
    return <p className={cn("text-sm italic text-muted-foreground", className)}>This comment was deleted.</p>;
  }

  return (
    <p className={cn("text-sm leading-relaxed whitespace-pre-wrap break-words", className)}>
      {renderWithMentions(content)}
    </p>
  );
}
