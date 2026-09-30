import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CommentUser } from "@/mocks/comments";
import { cn } from "@/libs/utils";

interface CommentComposerProps {
  currentUser: CommentUser;
  placeholder?: string;
  initialValue?: string;
  quotePreview?: string;
  onCancel?: () => void;
  onSubmit?: (content: string) => void;
  autoFocus?: boolean;
  showAvatar?: boolean;
  className?: string;
}

export function CommentComposer({
  currentUser,
  placeholder = "Add a comment…",
  initialValue = "",
  quotePreview,
  onCancel,
  onSubmit,
  autoFocus,
  showAvatar = true,
  className,
}: CommentComposerProps) {
  const [value, setValue] = useState(initialValue);
  const initial = (currentUser.display_name ?? currentUser.username).slice(0, 1).toUpperCase();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
    setValue("");
  }

  return (
    <form className={cn("flex gap-2.5", className)} onSubmit={handleSubmit}>
      {showAvatar ? (
        <span className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {currentUser.avatar_url ? (
            <img src={currentUser.avatar_url} alt="" className="size-full object-cover" width={36} height={36} />
          ) : (
            <span className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
              {initial}
            </span>
          )}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 space-y-2">
        {quotePreview ? (
          <p className="rounded-md border-l-2 border-primary/60 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground line-clamp-2">
            {quotePreview}
          </p>
        ) : null}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={2}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <p className="text-[11px] text-muted-foreground">Tip: use @username to mention someone</p>
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={!value.trim()}>
            Comment
          </Button>
        </div>
      </div>
    </form>
  );
}
