import { useEffect, useState } from "react";
import { ChevronDown, Clapperboard, Eye, UserPlus } from "lucide-react";

import { ActressReportButton } from "@/components/actress/actress-report-button";
import { ActressStat } from "@/components/actress/actress-stat";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { ActressSummary } from "@/libs/actresses";
import { formatBirthdayLabel, formatMeasurements } from "@/libs/actresses";
import { cn } from "@/libs/utils";

const BANNER_PLACEHOLDER = "https://placehold.co/1920x640/1a1220/6b5a70?text=No+Banner";
const PARALLAX_FACTOR = 0.85;

interface ActressBannerProps {
  actress: ActressSummary;
  className?: string;
}

export function ActressBanner({ actress, className }: ActressBannerProps) {
  const backgroundUrl = actress.image_url || BANNER_PLACEHOLDER;
  const birthdayLabel = formatBirthdayLabel(actress.birthday);
  const measurements = formatMeasurements(actress);
  const hasProfileDetails = Boolean(birthdayLabel || measurements);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);

  useEffect(() => {
    function handleScroll() {
      setParallaxY(window.scrollY * PARALLAX_FACTOR);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className={cn("relative isolate min-h-88 overflow-hidden xs:min-h-104 lg:min-h-120", className)}>
      <div className="absolute inset-0 -z-20" aria-hidden>
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
          style={{ transform: `translate3d(0, ${parallaxY}px, 0)` }}
          referrerPolicy="no-referrer"
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-background via-background/50 to-background/10"
        aria-hidden
      />

      <div className="mx-auto flex min-h-88 w-full flex-col justify-end gap-4 px-6 pt-28 pb-6 xs:min-h-104 xs:px-10 xs:pt-32 xs:pb-8 lg:min-h-120 lg:px-16 lg:pb-10">
        <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 xs:flex-row xs:items-center xs:gap-5">
            <span className="size-[min(8.75rem,calc(100vw-3rem))] shrink-0 overflow-hidden rounded-xl bg-muted shadow-lg">
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
                    <button
                      type="button"
                      onClick={() => setDetailsOpen((v) => !v)}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <span className="line-clamp-1">Profile details</span>
                      <ChevronDown
                        className={cn("size-3.5 shrink-0 transition-transform xs:size-4", detailsOpen && "rotate-180")}
                      />
                    </button>
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
      </div>
    </section>
  );
}
