import { Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";

const footerLinks = [
  { label: "About", to: "/about" as const },
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
  { label: "Sign in", to: "/sign-in" as const },
] as const;

export default function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="flex w-full flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row sm:px-10 lg:px-16">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Clapperboard className="size-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Velvet</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              search={"search" in link ? link.search : undefined}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Velvet Media</p>
      </div>
    </footer>
  );
}
