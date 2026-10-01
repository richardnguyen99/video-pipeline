import { Clock, Star, Trash2 } from "lucide-react";

import type { RecentQuery } from "@/libs/search/search-history";
import { cn } from "@/libs/utils";

import { HistoryActionButton } from "./history-action-button";

interface HistoryQueryItemProps {
  entry: RecentQuery;
  optionId: string;
  active: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
}

export function HistoryQueryItem({
  entry,
  optionId,
  active,
  onSelect,
  onMouseEnter,
  onToggleFavorite,
  onRemove,
}: HistoryQueryItemProps) {
  const { query, favorite } = entry;

  return (
    <li id={optionId} role="option" aria-selected={active} className="group/query relative" onMouseEnter={onMouseEnter}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 pr-17 text-left text-sm transition-colors",
          active ? "bg-muted" : "hover:bg-muted/70",
        )}
        onClick={onSelect}
      >
        <Clock className="size-4 shrink-0 text-muted-foreground" />

        <span className="min-w-0 flex-1 truncate font-medium">{query}</span>
      </button>

      <div
        className={cn(
          "absolute top-1/2 right-1.5 z-10 flex -translate-y-1/2 items-center gap-0.5",
          "transition-opacity",
          favorite ? "opacity-100" : "opacity-0 group-hover/query:opacity-100 focus-within:opacity-100",
          active && !favorite ? "opacity-100" : null,
        )}
      >
        <HistoryActionButton
          label={favorite ? `Remove “${query}” from favorites` : `Mark “${query}” as favorite`}
          tooltip={favorite ? "Remove from favorites" : "Add to favorites"}
          pressed={favorite}
          className={
            favorite
              ? "text-amber-400 hover:bg-amber-400/15 hover:text-amber-300"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }
          onClick={onToggleFavorite}
        >
          <Star className={cn("size-3.5", favorite ? "fill-amber-400 text-amber-400" : "fill-none")} />
        </HistoryActionButton>

        <HistoryActionButton
          label={`Remove search “${query}”`}
          tooltip="Remove this search"
          className={cn(
            "text-muted-foreground",
            "hover:bg-destructive/15 hover:text-destructive",
            "focus-visible:ring-destructive/30",
            favorite ? "opacity-0 group-hover/query:opacity-100 focus-within:opacity-100" : null,
            active && favorite ? "opacity-100" : null,
          )}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </HistoryActionButton>
      </div>
    </li>
  );
}
