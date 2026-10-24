import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileVideo, FolderOpen, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import { useAuthStore } from "@/stores/auth-store";

const RECENT_VIDEOS = [
  {
    title: "Behind the scenes — episode 04",
    size: "1.8 GB",
    uploaded: "Uploaded today",
    status: "Published",
  },
  {
    title: "Creator Q&A highlights",
    size: "842 MB",
    uploaded: "Uploaded yesterday",
    status: "Processing",
  },
  {
    title: "Summer lookbook",
    size: "2.4 GB",
    uploaded: "Jun 18, 2026",
    status: "Published",
  },
] as const;

function greetingHourLabel(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function statusClass(status: string): string {
  const key = status.toLowerCase();

  if (key === "published") {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  }

  if (key === "processing") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }

  return "bg-muted text-muted-foreground";
}

export function StudioDashboard() {
  const user = useAuthStore((state) => state.user);

  const displayName = useMemo(() => {
    return user?.display_name?.trim() || user?.username || "Creator";
  }, [user]);

  const greeting = `${greetingHourLabel()}, ${displayName}.`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Creator workspace</span>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting}</h1>

          <p className="text-muted-foreground text-sm">Here is what is happening with your channel.</p>
        </div>

        <Button type="button" nativeButton={false} render={<Link to="/studio/upload" />}>
          <Upload data-icon="inline-start" className="size-4" />
          Upload video
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total views", value: "128.4K", note: "+18.6% this month", positive: true },
          { label: "Published videos", value: "24", note: "3 this month", positive: false },
          { label: "Watch time", value: "2,840h", note: "+12.4% this month", positive: true },
          { label: "Subscribers", value: "8,492", note: "+4.8% this month", positive: true },
        ].map((stat) => (
          <div key={stat.label} className="bg-card flex flex-col gap-1 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs">{stat.label}</span>

            <strong className="text-2xl font-semibold tracking-tight">{stat.value}</strong>

            <small
              className={cn(
                "text-xs",
                stat.positive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {stat.note}
            </small>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <article className="bg-card flex flex-col gap-4 rounded-xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Performance</span>

              <h2 className="text-lg font-semibold">Channel overview</h2>
            </div>

            <Button type="button" variant="ghost" size="sm">
              Last 30 days
              <ChevronRight data-icon="inline-end" className="size-3.5" />
            </Button>
          </div>

          <div className="text-primary relative h-48 w-full">
            <div className="text-muted-foreground absolute inset-y-0 left-0 flex flex-col justify-between py-1 text-[10px]">
              <span>8k</span>
              <span>6k</span>
              <span>4k</span>
              <span>2k</span>
              <span>0</span>
            </div>

            <svg
              className="ml-6 h-full w-[calc(100%-1.5rem)]"
              viewBox="0 0 640 190"
              preserveAspectRatio="none"
              aria-label="Channel views chart"
            >
              <path
                d="M0 155 C60 145 70 115 130 126 S200 155 250 105 S315 78 360 96 S420 120 470 62 S535 75 580 38 S610 30 640 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
          </div>

          <div className="text-muted-foreground ml-6 flex justify-between text-[10px]">
            <span>May 22</span>
            <span>May 29</span>
            <span>Jun 05</span>
            <span>Jun 12</span>
            <span>Jun 19</span>
          </div>
        </article>

        <article className="bg-card flex flex-col gap-3 rounded-xl border p-5">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quick actions</span>

            <h2 className="text-lg font-semibold">Keep creating</h2>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 px-3 py-3 text-left"
            nativeButton={false}
            render={<Link to="/studio/upload" />}
          >
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
              <Upload className="size-4" />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">Upload a new video</span>
              <span className="text-muted-foreground text-xs font-normal">Share something with your audience</span>
            </span>

            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          </Button>

          <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-3 py-3 text-left">
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
              <FolderOpen className="size-4" />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">Manage your library</span>
              <span className="text-muted-foreground text-xs font-normal">Browse all your uploaded videos</span>
            </span>

            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          </Button>
        </article>
      </div>

      <article className="bg-card flex flex-col gap-4 rounded-xl border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Your library</span>

            <h2 className="text-lg font-semibold">Recently uploaded</h2>
          </div>

          <Button type="button" variant="ghost" size="sm">
            View all
            <ChevronRight data-icon="inline-end" className="size-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="text-muted-foreground grid min-w-[36rem] grid-cols-[minmax(0,2fr)_6rem_9rem_7rem] gap-3 border-b px-1 pb-2 text-xs font-medium">
            <span>Video</span>
            <span>Size</span>
            <span>Uploaded</span>
            <span>Status</span>
          </div>

          <div className="flex min-w-[36rem] flex-col">
            {RECENT_VIDEOS.map((row) => (
              <div
                key={row.title}
                className="grid grid-cols-[minmax(0,2fr)_6rem_9rem_7rem] items-center gap-3 border-b px-1 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                    <FileVideo className="size-4" />
                  </span>

                  <strong className="truncate text-sm font-medium">{row.title}</strong>
                </div>

                <span className="text-muted-foreground text-sm">{row.size}</span>

                <span className="text-muted-foreground text-sm">{row.uploaded}</span>

                <span
                  className={cn(
                    "inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium",
                    statusClass(row.status),
                  )}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
