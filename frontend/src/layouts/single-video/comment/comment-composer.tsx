import { useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import type { CommentUser } from "@/queries/comments";
import { userSearchQueryOptions } from "@/queries/users";
import type { UserSearchItem } from "@/queries/users";
import { cn } from "@/libs/utils";

interface CommentComposerProps {
  currentUser: CommentUser;
  placeholder?: string;
  initialValue?: string;
  quotePreview?: string;
  localCandidates?: Array<CommentUser>;
  onCancel?: () => void;
  onSubmit?: (content: string) => void;
  autoFocus?: boolean;
  showAvatar?: boolean;
  className?: string;
}

type ActiveMention = {
  query: string;
  start: number;
  end: number;
};

function extractActiveMention(value: string, caret: number): ActiveMention | null {
  const before = value.slice(0, caret);
  const match = /(?:^|[\s([{])@([a-zA-Z0-9_]*)$/.exec(before);

  if (match == null) {
    return null;
  }

  const partial = match.at(1);

  if (partial === undefined) {
    return null;
  }

  const start = before.length - partial.length - 1;

  return {
    query: partial,
    start,
    end: caret,
  };
}

function buildMentionSuggestions(
  query: string,
  localCandidates: Array<CommentUser>,
  remoteItems: Array<UserSearchItem>,
  currentUsername: string,
): Array<{ username: string; displayName: string | null }> {
  const normalized = query.toLowerCase();
  const seen = new Set<string>();
  const suggestions: Array<{ username: string; displayName: string | null }> = [];

  function push(username: string, displayName: string | null) {
    const key = username.toLowerCase();

    if (key === "" || key === "deleted" || key === currentUsername.toLowerCase() || seen.has(key)) {
      return;
    }

    if (normalized !== "" && !key.startsWith(normalized) && !key.includes(normalized)) {
      return;
    }

    seen.add(key);
    suggestions.push({ username, displayName });
  }

  for (const candidate of localCandidates) {
    push(candidate.username, candidate.display_name ?? null);
  }

  for (const item of remoteItems) {
    push(item.username, item.display_name);
  }

  return suggestions.slice(0, 8);
}

export function CommentComposer({
  currentUser,
  placeholder = "Add a comment…",
  initialValue = "",
  quotePreview,
  localCandidates = [],
  onCancel,
  onSubmit,
  autoFocus,
  showAvatar = true,
  className,
}: CommentComposerProps) {
  const listId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialValue);
  const [caret, setCaret] = useState(initialValue.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);

  const activeMention = useMemo(() => extractActiveMention(value, caret), [value, caret]);
  const mentionQuery = activeMention == null ? "" : activeMention.query;
  const searchEnabled = activeMention != null && !mentionDismissed;

  const searchQuery = useQuery({
    ...userSearchQueryOptions(mentionQuery, { limit: 8 }),
    enabled: searchEnabled && mentionQuery.length >= 1,
  });

  const suggestions = useMemo(
    () => buildMentionSuggestions(mentionQuery, localCandidates, searchQuery.data?.items ?? [], currentUser.username),
    [mentionQuery, localCandidates, searchQuery.data?.items, currentUser.username],
  );

  const showSuggestions = searchEnabled && suggestions.length > 0;
  const safeActiveIndex = showSuggestions ? activeIndex % suggestions.length : 0;

  const initial = (currentUser.display_name ?? currentUser.username).slice(0, 1).toUpperCase();

  function updateCaretFromTextarea() {
    const el = textareaRef.current;

    if (el == null) {
      return;
    }

    setCaret(el.selectionStart);
  }

  function applyMention(username: string) {
    if (activeMention == null) {
      return;
    }

    const insertion = `@${username} `;
    const nextValue = `${value.slice(0, activeMention.start)}${insertion}${value.slice(activeMention.end)}`;
    const nextCaret = activeMention.start + insertion.length;

    setValue(nextValue);
    setCaret(nextCaret);
    setMentionDismissed(true);
    setActiveIndex(0);

    requestAnimationFrame(() => {
      const el = textareaRef.current;

      if (el == null) {
        return;
      }

      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    const nextCaret = event.target.selectionStart;

    setValue(next);
    setCaret(nextCaret);
    setMentionDismissed(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showSuggestions) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);

      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const selected = suggestions.at(safeActiveIndex);

      if (selected !== undefined) {
        applyMention(selected.username);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setMentionDismissed(true);
    }
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    onSubmit?.(trimmed);
    setValue("");
    setCaret(0);
    setMentionDismissed(false);
    setActiveIndex(0);
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

      <div className="relative min-w-0 flex-1 space-y-2">
        {quotePreview ? (
          <p className="rounded-md border-l-2 border-primary/60 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground line-clamp-2">
            {quotePreview}
          </p>
        ) : null}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={updateCaretFromTextarea}
            onKeyUp={updateCaretFromTextarea}
            onSelect={updateCaretFromTextarea}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={2}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? listId : undefined}
            aria-autocomplete="list"
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />

          {showSuggestions ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md"
            >
              {suggestions.map((item, index) => {
                const isActive = index === safeActiveIndex;
                const label = item.displayName?.trim() || item.username;

                return (
                  <li key={item.username} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applyMention(item.username);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {label.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">@{item.username}</span>
                        {item.displayName != null && item.displayName.trim() !== "" ? (
                          <span className="block truncate text-xs text-muted-foreground">{item.displayName}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="flex justify-between items-center">
          <p className="text-[11px] text-muted-foreground">Tip: type @ to mention someone</p>

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
      </div>
    </form>
  );
}
