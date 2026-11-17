import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CommentRichEditor } from "@/components/comment-editor/comment-rich-editor";
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
  const [draftHtml, setDraftHtml] = useState(initialValue);
  const [draftText, setDraftText] = useState(initialValue);
  const [isEmpty, setIsEmpty] = useState(initialValue.trim() === "");
  const [editorKey, setEditorKey] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);

  const activeMention = useMemo(() => extractActiveMention(draftText, draftText.length), [draftText]);
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
  const safeActiveIndex = suggestions.length === 0 ? 0 : Math.min(activeIndex, suggestions.length - 1);

  const initial = (currentUser.display_name?.trim() || currentUser.username).slice(0, 1).toUpperCase();

  function handleEditorChange(payload: { html: string; markdown: string; text: string; isEmpty: boolean }) {
    setDraftHtml(payload.html);
    setDraftText(payload.text);
    setIsEmpty(payload.isEmpty);
    setMentionDismissed(false);
    setActiveIndex(0);
  }

  function applyMention(username: string) {
    if (activeMention == null) {
      return;
    }

    const before = draftText.slice(0, activeMention.start);
    const after = draftText.slice(activeMention.end);
    const nextText = `${before}@${username} ${after}`;
    setDraftText(nextText);
    setDraftHtml(`<p>${nextText.replace(/\n/g, "<br />")}</p>`);
    setIsEmpty(nextText.trim() === "");
    setMentionDismissed(true);
    setActiveIndex(0);
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isEmpty) {
      return;
    }

    const content = draftHtml.trim() === "" || draftHtml === "<p></p>" ? draftText.trim() : draftHtml;

    if (!content.trim()) {
      return;
    }

    onSubmit?.(content);
    setDraftHtml("");
    setDraftText("");
    setIsEmpty(true);
    setEditorKey((key) => key + 1);
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
          <CommentRichEditor
            key={editorKey}
            initialValue={draftHtml || draftText}
            placeholder={placeholder}
            autoFocus={autoFocus}
            onChange={handleEditorChange}
            onSubmitKey={() => {
              if (!isEmpty) {
                const content = draftHtml.trim() === "" || draftHtml === "<p></p>" ? draftText.trim() : draftHtml;
                onSubmit?.(content);
                setDraftHtml("");
                setDraftText("");
                setIsEmpty(true);
                setEditorKey((key) => key + 1);
              }
            }}
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

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Tip: type @ to mention · switch to markdown with the code icon
          </p>

          <div className="flex justify-end gap-2">
            {onCancel ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}

            <Button type="submit" size="sm" disabled={isEmpty}>
              Comment
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
