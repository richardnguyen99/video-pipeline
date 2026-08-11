import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clapperboard, Menu, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";

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
  { label: "Genres", to: "/genres" as const },
  { label: "Actresses", to: "/actresses" as const },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-border/60 bg-background/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="flex h-16 items-center justify-between px-6 sm:px-10 lg:px-16">
        <Link to="/" className="flex items-center gap-2">
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

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Search" className="hidden sm:inline-flex">
            <Search className="size-4" />
          </Button>
          <Button size="sm" className="hidden sm:inline-flex" nativeButton={false} render={<Link to="/sign-in" />}>
            Sign in
          </Button>
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
            <Button
              size="sm"
              className="mt-2"
              nativeButton={false}
              render={<Link to="/sign-in" />}
              onClick={() => setOpen(false)}
            >
              Sign in
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
