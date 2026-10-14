import { AtSign, Heart, KeyRound, ListVideo, LogIn, Mail, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

import type { UserActivityItem } from "@/queries/auth-activity";

type HistoryRowProps = {
  item: UserActivityItem;
};

function formatCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function metaString(metadata: Record<string, unknown> | null, key: string): string | null {
  if (metadata == null) {
    return null;
  }

  const value = metadata[key];

  if (value == null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return null;
}

function activityCopy(item: UserActivityItem): {
  title: string;
  detail: string | null;
  icon: ReactNode;
} {
  const metadata = item.metadata;

  switch (item.event_type) {
    case "login": {
      const ip = item.ip_address?.trim() || null;
      const browser = item.browser_label?.trim() || null;

      return {
        title: "Signed in",
        detail: [browser, ip].filter(Boolean).join(" · ") || null,
        icon: <LogIn className="size-4" aria-hidden />,
      };
    }
    case "password_change":
      return {
        title: "Password changed",
        detail: "All other sessions were signed out.",
        icon: <KeyRound className="size-4" aria-hidden />,
      };
    case "username_change": {
      const oldUsername = metaString(metadata, "old_username");
      const newUsername = metaString(metadata, "new_username");

      return {
        title: "Username changed",
        detail:
          oldUsername != null && newUsername != null
            ? `@${oldUsername} → @${newUsername}`
            : newUsername != null
              ? `Now @${newUsername}`
              : null,
        icon: <AtSign className="size-4" aria-hidden />,
      };
    }
    case "email_change": {
      const oldEmail = metaString(metadata, "old_email");
      const newEmail = metaString(metadata, "new_email");

      return {
        title: "Email changed",
        detail:
          oldEmail != null && newEmail != null
            ? `${oldEmail} → ${newEmail}`
            : newEmail != null
              ? `Now ${newEmail}`
              : null,
        icon: <Mail className="size-4" aria-hidden />,
      };
    }
    case "like": {
      const contentId = metaString(metadata, "content_id");
      const title = metaString(metadata, "title");

      return {
        title: "Liked a video",
        detail: [contentId, title].filter(Boolean).join(" · ") || null,
        icon: <Heart className="size-4" aria-hidden />,
      };
    }
    case "comment": {
      const contentId = metaString(metadata, "content_id");
      const title = metaString(metadata, "title");
      const preview = metaString(metadata, "preview");

      return {
        title: "Commented on a video",
        detail: [contentId, title, preview].filter(Boolean).join(" · ") || null,
        icon: <MessageSquare className="size-4" aria-hidden />,
      };
    }
    case "playlist_create": {
      const name = metaString(metadata, "name");
      const visibility = metaString(metadata, "visibility");

      return {
        title: "Created a playlist",
        detail: name != null ? (visibility != null ? `${name} · ${visibility}` : name) : null,
        icon: <ListVideo className="size-4" aria-hidden />,
      };
    }
    default:
      return {
        title: item.event_type.replaceAll("_", " "),
        detail: null,
        icon: <LogIn className="size-4" aria-hidden />,
      };
  }
}

export function HistoryRow({ item }: HistoryRowProps) {
  const { title, detail, icon } = activityCopy(item);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>

        <div className="min-w-0">
          <p className="text-sm font-medium capitalize">{title}</p>

          {detail != null ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}

          <p className="mt-1 text-xs text-muted-foreground">{formatCreatedAt(item.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
