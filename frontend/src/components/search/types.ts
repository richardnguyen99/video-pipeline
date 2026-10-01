import type { SearchResult } from "@/libs/search/video-api-connector";

export type SiteSearchBoxProps = {
  className?: string;
  compact?: boolean;
  defaultValue?: string;
  onNavigate?: () => void;
  /** Register global Mod+K to focus this instance (desktop header only). */
  enableHotkey?: boolean;
};

export type PanelMode = "history" | "autocomplete";

export type ResolvedOption =
  { kind: "query"; query: string } | { kind: "video"; video: SearchResult } | { kind: "search-all" };
