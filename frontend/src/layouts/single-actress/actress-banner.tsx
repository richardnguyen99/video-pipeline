import { useState } from "react";
import { ChevronDown, Clapperboard, Eye, UserPlus } from "lucide-react";

import { ActressStat } from "@/components/actress/actress-stat";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { ActressSummary } from "@/libs/actresses";
import { formatBirthdayLabel, formatMeasurements } from "@/libs/actresses";
import { cn } from "@/libs/utils";

interface ActressBannerProps {
  actress: ActressSummary;
  className?: string;
}

export function ActressBanner({ actress, className }: ActressBannerProps) {
  const backgroundUrl = actress.image_url;
  const birthdayLabel = formatBirthdayLabel(actress.birthday);
  const measurements = formatMeasurements(actress);
  const hasProfileDetails = Boolean(birthdayLabel || measurements);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  return (
    <section
      className={cn(
        "relative isolate min-h-[22rem] overflow-hidden border-b border-border sm:min-h-[26rem] lg:min-h-[30rem]",
        className,
      )}
    >
      <div className="absolute inset-0 -z-20">
        {backgroundUrl ? (
          <img src={backgroundUrl} alt="" className="size-full scale-110 object-cover blur-sm" aria-hidden />
        ) : (
          <div className="size-full bg-muted" />
        )}
      </div>

      <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/55 to-transparent" aria-hidden />

      <div className="mx-auto flex min-h-[22rem] w-full flex-col justify-end gap-6 px-6 pt-28 pb-10 sm:min-h-[26rem] sm:px-10 sm:pt-32 sm:pb-12 lg:min-h-[30rem] lg:flex-row lg:items-end lg:justify-between lg:px-16 lg:pb-14">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <span className="size-[140px] shrink-0 overflow-hidden rounded-xl bg-muted shadow-lg">
            {actress.image_url ? (
              <img src={actress.image_url} alt="" width={140} height={140} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {actress.name.slice(0, 1)}
              </span>
            )}
          </span>

          <div className="min-w-0 space-y-3">
            <div>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
                {actress.name}
              </h1>
              {actress.ruby ? (
                <p className="mt-0.5 truncate text-sm text-white/75 sm:text-base">{actress.ruby}</p>
              ) : null}
            </div>

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={subscribed ? "secondary" : "default"}
                  size="sm"
                  className="w-fit"
                  onClick={() => setSubscribed((v) => !v)}
                >
                  <UserPlus className="size-4" />
                  {subscribed ? "Subscribed" : "Subscribe"}
                </Button>

                {hasProfileDetails ? (
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
                  >
                    Profile details
                    <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
                  </button>
                ) : null}
              </div>

              {hasProfileDetails ? (
                <CollapsibleContent>
                  <div className="mt-2 space-y-1 text-sm text-white/80">
                    {birthdayLabel ? (
                      <p>
                        <span className="text-white/55">Born </span>
                        {birthdayLabel}
                      </p>
                    ) : null}
                    {measurements ? (
                      <p>
                        <span className="text-white/55">Body </span>
                        {measurements}
                      </p>
                    ) : null}
                  </div>
                </CollapsibleContent>
              ) : null}
            </Collapsible>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-white/90 lg:gap-x-8">
          <ActressStat icon={Clapperboard} value={actress.videoCount} label="Videos" />
          <ActressStat icon={Eye} value={actress.totalViews} label="Views" />
          <ActressStat icon={UserPlus} value={actress.subscribers} label="Subscribers" />
        </div>
      </div>
    </section>
  );
}
