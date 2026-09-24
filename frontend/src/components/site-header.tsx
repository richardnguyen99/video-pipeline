import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, LogOut, Menu, UserRound, X } from "lucide-react";

import { SiteSearchBox } from "@/components/search/site-search-box";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

const navLinks = [
  { label: "Videos", to: "/videos" as const },
  {
    label: "Trending",
    to: "/videos" as const,
    search: { sort: "trending-week" as const },
  },
  {
    label: "Latest",
    to: "/videos" as const,
    search: { sort: "latest" as const },
  },
  { label: "Actresses", to: "/actresses" as const },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    void navigate({ to: "/" });
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-border/60 bg-background/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="flex h-16 items-center justify-between gap-3 px-6 sm:px-10 lg:px-16">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_20px_-2px_var(--color-primary)]">
            <Clapperboard className="size-4" />
          </span>

          <span className="text-lg font-semibold tracking-tight">Velvet</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              search={"search" in link ? link.search : undefined}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <SiteSearchBox className="hidden max-w-md flex-1 sm:block" compact enableHotkey />

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-[0_0_16px_-4px_var(--color-primary)] transition-colors hover:bg-primary/90">
                <UserRound className="size-4" aria-hidden />

                <span className="max-w-28 truncate">{user?.username}</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{user?.username}</span>

                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    void navigate({ to: "/account" });
                  }}
                >
                  Account
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" className="hidden sm:inline-flex" nativeButton={false} render={<Link to="/sign-in" />}>
              Sign in
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle menu"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border/60 bg-background/95 px-4 py-3 md:hidden">
          <SiteSearchBox className="mb-3" onNavigate={() => setOpen(false)} />

          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                search={"search" in link ? link.search : undefined}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:text-foreground"
              >
                {link.label}
              </Link>
            ))}

            {isAuthenticated ? (
              <>
                <Link
                  to="/account"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Account
                </Link>

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="mt-2"
                nativeButton={false}
                render={<Link to="/sign-in" />}
                onClick={() => setOpen(false)}
              >
                Sign in
              </Button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
