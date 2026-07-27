import { Clapperboard, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CtaFooter() {
  return (
    <>
      <footer className="border-t border-border/60">
        <div className="flex w-full flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row sm:px-10 lg:px-16">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clapperboard className="size-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Velvet</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">
              About
            </a>
            <a href="#genres" className="transition-colors hover:text-foreground">
              Genres
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Support
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Privacy
            </a>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Velvet Media</p>
        </div>
      </footer>
    </>
  );
}
