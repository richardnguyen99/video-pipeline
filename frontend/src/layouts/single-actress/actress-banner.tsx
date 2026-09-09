import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clapperboard, Eye, UserPlus } from "lucide-react";

import { ActressReportButton } from "@/components/actress/actress-report-button";
import { ActressStat } from "@/components/actress/actress-stat";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { ActressSummary } from "@/libs/actresses";
import { formatBirthdayLabel, formatMeasurements } from "@/libs/actresses";
import { cn } from "@/libs/utils";

const BANNER_PLACEHOLDER = "https://placehold.co/1920x640/1a1220/6b5a70?text=No+Banner";
const PARALLAX_FACTOR = 0.35;
const PARALLAX_SCALE = 1.12;

interface ActressBannerBackgroundProps {
  actress: ActressSummary;
  className?: string;
}

export function ActressBannerBackground({ actress, className }: ActressBannerBackgroundProps) {
  const backgroundUrl =
    (actress.banner?.url != null && actress.banner.url !== "" ? actress.banner.url : undefined) ??
    actress.image_url ??
    BANNER_PLACEHOLDER;
  const [parallaxY, setParallaxY] = useState(0);
  const mediaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() {
      const height = mediaRef.current?.offsetHeight ?? 0;
      const maxOffset = height * ((PARALLAX_SCALE - 1) / 2);
      const next = Math.min(window.scrollY * PARALLAX_FACTOR, maxOffset);

      setParallaxY(next);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div
      ref={mediaRef}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-0 aspect-4/3 w-full overflow-hidden md:aspect-video lg:aspect-21/9",
        className,
      )}
      aria-hidden
    >
      <img
        src={backgroundUrl}
        alt=""
        className="absolute inset-0 h-[120%] md:h-full w-full object-cover will-change-transform"
        style={{ transform: `translate3d(0, ${parallaxY}px, 0) scale(${PARALLAX_SCALE})` }}
        referrerPolicy="no-referrer"
      />

      <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
    </div>
  );
}

interface ActressProfileHeaderProps {
  actress: ActressSummary;
  className?: string;
}

export function ActressProfileHeader({ actress, className }: ActressProfileHeaderProps) {
  const birthdayLabel = formatBirthdayLabel(actress.birthday);
  const measurements = formatMeasurements(actress);
  const hasProfileDetails = Boolean(birthdayLabel || measurements);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  return (
    <header
      className={cn(
        "relative z-10 mx-auto flex w-full flex-col gap-4 px-6 pt-20 pb-6 xs:px-10 xs:pt-24 xs:pb-8 lg:px-16 lg:pt-28 lg:pb-10",
        className,
      )}
    >
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 xs:flex-row xs:items-center xs:gap-5">
          <span className="size-[min(8.75rem,calc(100vw-3rem))] shrink-0 overflow-hidden rounded-xl bg-muted shadow-lg ring-1 ring-border/40">
            {actress.image_url ? (
              <img
                src={actress.image_url}
                alt=""
                width={140}
                height={140}
                className="size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {actress.name.slice(0, 1)}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1 space-y-2 xs:space-y-3">
            <div>
              <h1 className="line-clamp-2 text-2xl font-semibold tracking-tight text-foreground xs:line-clamp-1 xs:text-3xl lg:text-4xl">
                {actress.name}
              </h1>
              {actress.ruby ? (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground xs:line-clamp-1 xs:text-base">
                  {actress.ruby}
                </p>
              ) : null}
            </div>

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <div className="flex min-w-0 flex-col items-start gap-2 xs:flex-row xs:flex-wrap xs:items-center xs:gap-3">
                <Button
                  type="button"
                  variant={subscribed ? "secondary" : "default"}
                  size="sm"
                  className="w-fit max-w-48"
                  onClick={() => setSubscribed((v) => !v)}
                >
                  <UserPlus className="size-3.5 shrink-0 xs:size-4" />
                  <span className="line-clamp-1">{subscribed ? "Subscribed" : "Subscribe"}</span>
                </Button>

                {hasProfileDetails ? (
                  <Button type="button" onClick={() => setDetailsOpen((v) => !v)} variant="ghost">
                    <span className="line-clamp-1">Profile details</span>
                    <ChevronDown
                      className={cn("size-3.5 shrink-0 transition-transform xs:size-4", detailsOpen && "rotate-180")}
                    />
                  </Button>
                ) : null}
              </div>

              {hasProfileDetails ? (
                <CollapsibleContent>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {birthdayLabel ? (
                      <p>
                        <span className="text-muted-foreground/70">Born </span>
                        {birthdayLabel}
                      </p>
                    ) : null}
                    {measurements ? (
                      <p>
                        <span className="text-muted-foreground/70">Body </span>
                        {measurements}
                      </p>
                    ) : null}
                  </div>
                </CollapsibleContent>
              ) : null}
            </Collapsible>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-foreground lg:gap-x-8">
          <ActressStat icon={Clapperboard} value={actress.videoCount} label="Videos" />
          <ActressStat icon={Eye} value={actress.totalViews} label="Views" />
          <ActressStat icon={UserPlus} value={actress.subscribers} label="Subscribers" />
        </div>
      </div>

      <div className="flex justify-start">
        <ActressReportButton />
      </div>
    </header>
  );
}
