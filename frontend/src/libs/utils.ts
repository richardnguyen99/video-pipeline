import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDate(dateStr?: string, options?: { unknownLabel?: string }): string {
  const unknownLabel = options?.unknownLabel ?? "Unknown";
  if (!dateStr) return unknownLabel;

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return unknownLabel;

  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;

  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/** Compact count: 1.2K / 3.4M */
export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";

  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;

  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;

  return String(Math.round(n));
}

/**
 * Duration from minutes (decimal ok) → `m:ss` or `h:mm:ss`.
 */
export function formatDuration(minutes?: number): string {
  if (minutes == null || Number.isNaN(minutes)) return "0:00";
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Absolute calendar date → `YYYY-MM-DD`.
 * Returns em dash when missing; falls back to the raw string if unparseable.
 */
export function formatReleaseDate(dateStr?: string, emptyLabel = "—"): string {
  if (!dateStr) return emptyLabel;

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}
