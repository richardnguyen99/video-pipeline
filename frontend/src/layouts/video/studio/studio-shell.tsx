import { useState } from "react";
import type { ReactNode } from "react";
import { Link, Outlet, useRouteContext, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileVideo,
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

const STUDIO_TOOLTIP_CLASS = "bg-popover text-popover-foreground border-border border shadow-md";

const NAV_ITEMS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    to: "/studio" as const,
  },
  {
    id: "uploads",
    label: "Uploads",
    icon: Upload,
    to: "/studio/upload" as const,
  },
  {
    id: "videos",
    label: "Videos",
    icon: FileVideo,
    to: null,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    to: null,
  },
  {
    id: "audience",
    label: "Audience",
    icon: Users,
    to: null,
  },
] as const;

function isNavActive(pathname: string, to: string | null): boolean {
  if (to == null) {
    return false;
  }

  if (to === "/studio") {
    return pathname === "/studio" || pathname === "/studio/";
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

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

function SidebarNavLink({
  collapsed,
  label,
  isActive,
  to,
  onNavigate,
  children,
}: {
  collapsed: boolean;
  label: string;
  isActive: boolean;
  to: "/studio" | "/studio/upload";
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const linkSearch = to === "/studio/upload" ? {} : undefined;

  if (!collapsed) {
    return (
      <Button
        type="button"
        variant={isActive ? "secondary" : "ghost"}
        className="h-10 w-full justify-start gap-3 px-3"
        aria-label={label}
        nativeButton={false}
        render={<Link to={to} search={linkSearch} onClick={onNavigate} />}
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
            nativeButton={false}
            render={<Link to={to} search={linkSearch} onClick={onNavigate} />}
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

function SidebarProfileLink({ collapsed, username }: { collapsed: boolean; username: string }) {
  const label = username;

  if (!collapsed) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full justify-start gap-3 px-3"
        aria-label={label}
        nativeButton={false}
        render={<Link to="/u/$username" params={{ username }} />}
      >
        <UserRound className="size-4 shrink-0" />
        <span className="truncate">@{username}</span>
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
            render={<Link to="/u/$username" params={{ username }} />}
          />
        }
      >
        <UserRound className="size-4 shrink-0" />
      </TooltipTrigger>

      <TooltipContent side="right" sideOffset={10} className={STUDIO_TOOLTIP_CLASS}>
        @{label}
      </TooltipContent>
    </Tooltip>
  );
}

export function StudioShell() {
  const storeUser = useAuthStore((state) => state.user);
  const routeAuth = useRouteContext({
    from: "__root__",
    select: (ctx) => ctx.auth,
  });
  const user = storeUser ?? routeAuth.user ?? null;
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const username = user?.username ?? null;

  return (
    <div
      className={cn("bg-background text-foreground flex h-svh w-full overflow-hidden", collapsed && "studio-collapsed")}
    >
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
          "border-border bg-card fixed inset-y-0 left-0 z-50 flex h-svh flex-col border-r transition-[width,transform] duration-200 lg:static lg:h-full lg:translate-x-0",
          collapsed ? "w-18 lg:w-18" : "w-64 lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn("flex shrink-0 items-center border-b py-3", collapsed ? "justify-center px-2" : "gap-2 px-3")}
        >
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
          className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2", collapsed && "items-center")}
          aria-label="Studio navigation"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.to);

            if (item.to != null) {
              return (
                <SidebarNavLink
                  key={item.id}
                  collapsed={collapsed}
                  label={item.label}
                  isActive={active}
                  to={item.to}
                  onNavigate={() => {
                    setMobileOpen(false);
                  }}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </SidebarNavLink>
              );
            }

            return (
              <SidebarIconButton
                key={item.id}
                collapsed={collapsed}
                label={item.label}
                isActive={active}
                onClick={() => {
                  setMobileOpen(false);
                }}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </SidebarIconButton>
            );
          })}
        </nav>

        <div className={cn("flex shrink-0 flex-col gap-1 border-t p-2", collapsed && "items-center")}>
          {username != null ? <SidebarProfileLink collapsed={collapsed} username={username} /> : null}
        </div>
      </aside>

      <section data-studio-main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none]">
        <div className="flex shrink-0 items-center gap-2 px-4 pt-4 sm:px-6 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Open menu"
            onClick={() => {
              setMobileOpen(true);
            }}
          >
            <Menu className="size-4" />
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-10 lg:py-6">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
