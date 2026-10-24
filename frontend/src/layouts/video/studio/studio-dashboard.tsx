import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileVideo,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Upload,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/libs/utils";
import { useAuthStore } from "@/stores/auth-store";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "videos", label: "Videos", icon: FileVideo },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "audience", label: "Audience", icon: Users },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

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

const STUDIO_TOOLTIP_CLASS = "bg-popover text-popover-foreground border-border border shadow-md";

function SidebarIconButton({
  collapsed,
  label,
  isActive,
  onClick,
  children,
}: {
  collapsed: boolean;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (!collapsed) {
    return (
      <Button
        type="button"
        variant={isActive ? "secondary" : "ghost"}
        className="h-10 w-full justify-start gap-3 px-3"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={isActive ? "secondary" : "ghost"}
            className="size-10 shrink-0 justify-center p-0"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>

      <TooltipContent side="right" sideOffset={10} className={STUDIO_TOOLTIP_CLASS}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarIconLink({
  collapsed,
  label,
  to,
  params,
  children,
}:
  | {
      collapsed: boolean;
      label: string;
      to: "/";
      params?: undefined;
      children: ReactNode;
    }
  | {
      collapsed: boolean;
      label: string;
      to: "/u/$username";
      params: { username: string };
      children: ReactNode;
    }) {
  if (!collapsed) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full justify-start gap-3 px-3"
        aria-label={label}
        nativeButton={false}
        render={<Link to={to} params={params} />}
      >
        {children}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="size-10 shrink-0 justify-center p-0"
            aria-label={label}
            nativeButton={false}
            render={<Link to={to} params={params} />}
          />
        }
      >
        {children}
      </TooltipTrigger>

      <TooltipContent side="right" sideOffset={10} className={STUDIO_TOOLTIP_CLASS}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function StudioDashboard() {
  const user = useAuthStore((state) => state.user);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState<NavId>("overview");

  const displayName = useMemo(() => {
    return user?.display_name?.trim() || user?.username || "Creator";
  }, [user]);

  const username = user?.username ?? null;
  const greeting = `${greetingHourLabel()}, ${displayName}.`;

  return (
    <main className={cn("bg-background text-foreground flex min-h-screen w-full", collapsed && "studio-collapsed")}>
      {mobileOpen ? (
        <button
          type="button"
          className="bg-background/60 fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => {
            setMobileOpen(false);
          }}
        />
      ) : null}

      <aside
        className={cn(
          "border-border bg-card fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          collapsed ? "w-[4.5rem] lg:w-[4.5rem]" : "w-64 lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className={cn("flex items-center border-b py-3", collapsed ? "justify-center px-2" : "gap-2 px-3")}>
          {!collapsed ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 min-w-0 flex-1 justify-start gap-3 px-2"
              aria-label="Velvet home"
              nativeButton={false}
              render={<Link to="/" />}
            >
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
                V
              </span>

              <strong className="truncate text-sm tracking-tight">
                Velvet
                <span className="text-primary">.</span>
              </strong>
            </Button>
          ) : null}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-border bg-background text-foreground hover:bg-accent hidden size-9 shrink-0 border shadow-sm lg:inline-flex"
                  aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
                  onClick={() => {
                    setCollapsed((value) => !value);
                  }}
                />
              }
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </TooltipTrigger>

            <TooltipContent side={collapsed ? "right" : "bottom"} sideOffset={10} className={STUDIO_TOOLTIP_CLASS}>
              {collapsed ? "Show sidebar" : "Hide sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        <nav
          className={cn("flex flex-1 flex-col gap-1 p-2", collapsed && "items-center")}
          aria-label="Studio navigation"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <SidebarIconButton
                key={item.id}
                collapsed={collapsed}
                label={item.label}
                isActive={isActive}
                onClick={() => {
                  setActive(item.id);
                  setMobileOpen(false);
                }}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </SidebarIconButton>
            );
          })}
        </nav>

        <div className={cn("flex flex-col gap-1 border-t p-2", collapsed && "items-center")}>
          {username != null ? (
            <SidebarIconLink collapsed={collapsed} label={username} to="/u/$username" params={{ username }}>
              <UserRound className="size-4 shrink-0" />
              {!collapsed ? <span className="truncate">@{username}</span> : null}
            </SidebarIconLink>
          ) : null}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="mt-1 lg:hidden"
              aria-label="Open menu"
              onClick={() => {
                setMobileOpen(true);
              }}
            >
              <Menu className="size-4" />
            </Button>

            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Creator workspace
              </span>

              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting}</h1>

              <p className="text-muted-foreground text-sm">Here is what is happening with your channel.</p>
            </div>
          </div>

          <Button type="button" nativeButton={false} render={<Link to="/upload" />}>
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
              render={<Link to="/upload" />}
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

            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 px-3 py-3 text-left"
              onClick={() => {
                setActive("videos");
              }}
            >
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
            <div className="text-muted-foreground grid min-w-xl grid-cols-[minmax(0,2fr)_6rem_9rem_7rem] gap-3 border-b px-1 pb-2 text-xs font-medium">
              <span>Video</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span>Status</span>
            </div>

            <div className="flex min-w-xl flex-col">
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
      </section>
    </main>
  );
}
