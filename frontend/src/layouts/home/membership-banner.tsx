import { Link } from "@tanstack/react-router";
import { Bookmark, Heart, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const BENEFITS = [
  {
    icon: Bookmark,
    label: "Save videos to view later",
  },
  {
    icon: Heart,
    label: "Like and comment on videos",
  },
  {
    icon: Upload,
    label: "Upload videos",
  },
] as const;

const BANNER_IMAGE = "https://picsum.photos/id/1015/1600/600";

export function MembershipBanner() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return null;

  return (
    <section className="relative py-10 sm:py-14">
      <div className="px-6 sm:px-10 lg:px-16">
        <div className="relative overflow-hidden rounded-3xl border border-primary/40 shadow-[0_0_35px_-12px_var(--color-primary)]">
          <img src={BANNER_IMAGE} alt="" className="absolute inset-0 size-full scale-105 object-cover" loading="lazy" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-r from-background/90 via-background/50 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(70% 90% at 0% 50%, oklch(0.45 0.2 350 / 0.3) 0%, transparent 55%)",
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-primary/30" />

          <div className="relative z-10 max-w-2xl px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
            <h2 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">Become a member to</h2>

            <ul className="mt-6 space-y-4">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-base text-foreground sm:text-lg">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground">
                    <Icon className="size-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link to="/register" />}>
                Become a member
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link to="/sign-in" />}>
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
