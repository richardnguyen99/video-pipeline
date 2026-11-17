import type { ReactNode } from "react";

import { UserProfileLink } from "@/components/user/user-hover-card";
import { cn } from "@/libs/utils";

interface CommentBodyProps {
  content: string;
  isDeleted?: boolean;
  className?: string;
}

const MENTION_PATTERN = /(@[a-zA-Z0-9_]+)/g;
const MENTION_EXACT = /^@[a-zA-Z0-9_]+$/;
const LOOKS_LIKE_HTML = /<\/?[a-z][\s\S]*>/i;

function renderWithMentions(content: string): Array<ReactNode> {
  const parts = content.split(MENTION_PATTERN);

  return parts.map((part, index) => {
    if (!MENTION_EXACT.test(part)) {
      return <span key={`text-${index}`}>{part}</span>;
    }

    const username = part.slice(1);

    return (
      <UserProfileLink
        key={`mention-${username}-${index}`}
        username={username}
        className="font-semibold text-primary underline-offset-2 hover:underline"
      >
        {part}
      </UserProfileLink>
    );
  });
}

function sanitizeCommentHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const allowed = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "DEL",
    "CODE",
    "A",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "SPAN",
  ]);

  function walk(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode;

        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }

          parent.removeChild(el);
        }

        return;
      }

      if (el.tagName === "A") {
        const href = el.getAttribute("href") ?? "";

        if (!/^https?:\/\//i.test(href)) {
          el.removeAttribute("href");
        } else {
          el.setAttribute("rel", "noopener noreferrer nofollow");
          el.setAttribute("target", "_blank");
        }
      }

      for (const attr of Array.from(el.attributes)) {
        if (
          el.tagName === "A" &&
          (attr.name === "href" || attr.name === "rel" || attr.name === "target" || attr.name === "class")
        ) {
          continue;
        }

        if (attr.name === "class" || attr.name === "data-mention") {
          continue;
        }

        el.removeAttribute(attr.name);
      }
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  }

  walk(doc.body);

  return doc.body.innerHTML;
}

function enhanceMentionsInHtml(html: string): string {
  return html.replace(
    /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]+)/g,
    (_match, prefix: string, username: string) =>
      `${prefix}<span class="font-semibold text-primary" data-mention="@${username}">@${username}</span>`,
  );
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

  if (LOOKS_LIKE_HTML.test(content)) {
    const safe = enhanceMentionsInHtml(sanitizeCommentHtml(content));

    return (
      <div
        className={cn(
          "comment-body-html text-sm leading-relaxed wrap-break-word",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
          "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_p]:mb-2 [&_p:last-child]:mb-0",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }

  return (
    <p className={cn("text-sm leading-relaxed whitespace-pre-wrap wrap-break-word", className)}>
      {renderWithMentions(content)}
    </p>
  );
}
