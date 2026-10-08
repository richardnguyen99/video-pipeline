import { Globe, Lock, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/libs/utils";
import type { PlaylistVisibility } from "@/queries/playlist";

type VisibilityTone = "accent" | "warning" | "danger";

type VisibilityConfig = {
  label: string;
  tone: VisibilityTone;
  Icon: LucideIcon;
};

const VISIBILITY_CONFIG: Record<PlaylistVisibility, VisibilityConfig> = {
  public: {
    label: "Public",
    tone: "accent",
    Icon: Globe,
  },
  restricted: {
    label: "Restricted",
    tone: "warning",
    Icon: Users,
  },
  private: {
    label: "Private",
    tone: "danger",
    Icon: Lock,
  },
};

const TONE_CLASS: Record<VisibilityTone, string> = {
  accent: "bg-cyan-500/15 text-cyan-400",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
};

type VisibilityTagProps = {
  visibility: PlaylistVisibility;
  className?: string;
};

export function VisibilityTag({ visibility, className }: VisibilityTagProps) {
  const config = VISIBILITY_CONFIG[visibility];
  const { Icon, label, tone } = config;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function getVisibilityTone(visibility: PlaylistVisibility): VisibilityTone {
  return VISIBILITY_CONFIG[visibility].tone;
}
