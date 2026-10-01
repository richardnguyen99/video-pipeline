import { Search, Trash2 } from "lucide-react";

import type { SearchResult } from "@/libs/search/video-api-connector";
import { cn } from "@/libs/utils";

import { HistoryActionButton } from "./history-action-button";

interface SearchResultItemProps {
  result: SearchResult;
  optionId: string;
  active: boolean;
  isRecent?: boolean;
  showDelete?: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onDelete?: (label: string) => void;
}

export function SearchResultItem({
  result,
  optionId,
  active,
  isRecent = false,
  showDelete = false,
  onSelect,
  onMouseEnter,
  onDelete,
}: SearchResultItemProps) {
  const title = String(result.title?.raw ?? "");
  const code = String(result.video_id?.raw ?? "");
  const imageRaw = result.image_url?.raw;
  const image = imageRaw != null && imageRaw !== "" ? String(imageRaw) : null;

  return (
    <li
      id={optionId}
      role="option"
      aria-selected={active}
      className={cn(showDelete ? "group/video relative" : null)}
      onMouseEnter={onMouseEnter}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
          showDelete ? "pr-11" : null,
          isRecent
            ? cn("border-l-2 border-l-primary/70 bg-primary/5", active ? "bg-primary/15" : "hover:bg-primary/10")
            : active
              ? "bg-muted"
              : "hover:bg-muted/70",
        )}
        onClick={onSelect}
      >
        {image ? (
          <img src={image} alt="" className="size-10 shrink-0 rounded object-cover" loading="lazy" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
            <Search className="size-4" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 font-medium">{title}</span>

          <span
            className={cn(
              "mt-0.5 text-xs text-muted-foreground",
              isRecent && !showDelete ? "flex items-center gap-1.5" : "block",
            )}
          >
            {code}

            {isRecent && !showDelete ? (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">Recent</span>
            ) : null}
          </span>
        </span>
      </button>

      {showDelete && onDelete != null ? (
        <div
          className={cn(
            "absolute top-1/2 right-1.5 z-10 -translate-y-1/2",
            "opacity-0 transition-opacity",
            "group-hover/video:opacity-100 focus-within:opacity-100",
            active ? "opacity-100" : null,
          )}
        >
          <HistoryActionButton
            label={`Remove recent video “${title}”`}
            tooltip="Remove this video"
            className={cn(
              "text-muted-foreground",
              "hover:bg-destructive/15 hover:text-destructive",
              "focus-visible:ring-destructive/30",
            )}
            onClick={() => onDelete(code || title)}
          >
            <Trash2 className="size-3.5" />
          </HistoryActionButton>
        </div>
      ) : null}
    </li>
  );
}
