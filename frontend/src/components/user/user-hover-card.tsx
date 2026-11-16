import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { userPreviewQueryOptions } from "@/queries/user-preview";
import { cn, formatRelativeDate } from "@/libs/utils";

interface UserHoverCardProps {
  username: string;
  children: ReactNode;
  className?: string;
}

export function UserHoverCard({ username, children, className }: UserHoverCardProps) {
  const trimmed = username.trim();
  const canPreview = trimmed !== "" && trimmed !== "deleted";
  const [open, setOpen] = useState(false);

  if (!canPreview) {
    return <>{children}</>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        delay={300}
        closeDelay={150}
        className={cn("inline-flex max-w-full", className)}
        render={<span className={cn("inline-flex max-w-full", className)} />}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent>
        <UserHoverCardBody username={trimmed} enabled={open} />
      </HoverCardContent>
    </HoverCard>
  );
}

interface UserProfileLinkProps {
  username: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Profile link with hover preview — keeps click navigation to `/u/$username`. */
export function UserProfileLink({ username, children, className, ariaLabel }: UserProfileLinkProps) {
  const trimmed = username.trim();
  const canPreview = trimmed !== "" && trimmed !== "deleted";
  const [open, setOpen] = useState(false);

  if (!canPreview) {
    return <span className={className}>{children}</span>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        delay={300}
        closeDelay={150}
        render={<Link to="/u/$username" params={{ username: trimmed }} className={className} aria-label={ariaLabel} />}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent>
        <UserHoverCardBody username={trimmed} enabled={open} />
      </HoverCardContent>
    </HoverCard>
  );
}

function UserHoverCardBody({ username, enabled }: { username: string; enabled: boolean }) {
  const previewQuery = useQuery({
    ...userPreviewQueryOptions(username),
    enabled,
  });

  if (previewQuery.isPending) {
    return (
      <div className="flex gap-3">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    );
  }

  if (previewQuery.isError) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-semibold">@{username}</p>
        <p className="text-xs text-muted-foreground">Profile unavailable.</p>
        <Link to="/u/$username" params={{ username }} className="text-xs font-medium text-primary hover:underline">
          View profile
        </Link>
      </div>
    );
  }

  const preview = previewQuery.data;
  const displayName = preview.display_name?.trim() || preview.username;
  const initial = displayName.slice(0, 1).toUpperCase();
  const biography = preview.biography?.trim() ?? "";
  const joinedLabel = formatRelativeDate(preview.created_at);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Link
          to="/u/$username"
          params={{ username: preview.username }}
          className="size-12 shrink-0 overflow-hidden rounded-full bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {preview.avatar_url ? (
            <img src={preview.avatar_url} alt="" className="size-full object-cover" width={48} height={48} />
          ) : (
            <span className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
              {initial}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to="/u/$username"
            params={{ username: preview.username }}
            className="block truncate text-sm font-semibold hover:text-primary hover:underline"
          >
            {displayName}
          </Link>
          <p className="truncate text-xs text-muted-foreground">@{preview.username}</p>
          <p className="mt-1 text-xs text-muted-foreground">Joined {joinedLabel}</p>
        </div>
      </div>

      {biography !== "" ? (
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{biography}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">No biography yet.</p>
      )}
    </div>
  );
}
