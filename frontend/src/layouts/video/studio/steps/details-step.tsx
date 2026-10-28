import { useState } from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import {
  actressMultiFilterConfig,
  directorMultiFilterConfig,
  genreMultiFilterConfig,
  labelMultiFilterConfig,
  makerMultiFilterConfig,
  seriesMultiFilterConfig,
} from "@/components/entity-multi-filter/configs";
import { EntityMultiFilter } from "@/components/entity-multi-filter/index";
import type { EntityMultiFilterConfig } from "@/components/entity-multi-filter/index";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { RelationKey, RelationSelections } from "@/layouts/video/studio/types";
import { buttonVariants } from "@/libs/shadcn_variants";
import { cn } from "@/libs/utils";

function parseReleaseDate(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date());

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function formatReleaseDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const RELATION_FILTERS = [
  { key: "actresses" as const, label: "Actresses", config: actressMultiFilterConfig },
  { key: "makers" as const, label: "Makers", config: makerMultiFilterConfig },
  { key: "genres" as const, label: "Genres", config: genreMultiFilterConfig },
  { key: "series" as const, label: "Series", config: seriesMultiFilterConfig },
  { key: "labels" as const, label: "Labels", config: labelMultiFilterConfig },
  { key: "directors" as const, label: "Directors", config: directorMultiFilterConfig },
];

type DetailsStepProps = {
  title: string;
  description: string;
  videoCode: string;
  cid: string;
  jancode: string;
  makerProduct: string;
  releaseDate: string;
  relations: RelationSelections;
  notifySubscribers: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onVideoCodeChange: (value: string) => void;
  onCidChange: (value: string) => void;
  onJancodeChange: (value: string) => void;
  onMakerProductChange: (value: string) => void;
  onReleaseDateChange: (value: string) => void;
  onRelationIdsChange: (key: RelationKey, ids: Array<number>) => void;
  onNotifySubscribersChange: (value: boolean) => void;
};

export function DetailsStep({
  title,
  description,
  videoCode,
  cid,
  jancode,
  makerProduct,
  releaseDate,
  relations,
  notifySubscribers,
  onTitleChange,
  onDescriptionChange,
  onVideoCodeChange,
  onCidChange,
  onJancodeChange,
  onMakerProductChange,
  onReleaseDateChange,
  onRelationIdsChange,
  onNotifySubscribersChange,
}: DetailsStepProps) {
  const [releaseDateOpen, setReleaseDateOpen] = useState(false);
  const selectedReleaseDate = parseReleaseDate(releaseDate);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="studio-title">Video title</Label>

          <Input
            id="studio-title"
            value={title}
            onChange={(event) => {
              onTitleChange(event.target.value);
            }}
            placeholder="Give your video a clear, memorable title"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="studio-description">Description</Label>

          <Textarea
            id="studio-description"
            value={description}
            onChange={(event) => {
              onDescriptionChange(event.target.value);
            }}
            placeholder="Tell viewers what this video is about"
            rows={4}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="studio-video-code">Video code</Label>

          <Input
            id="studio-video-code"
            value={videoCode}
            onChange={(event) => {
              onVideoCodeChange(event.target.value);
            }}
            placeholder="Business / product code (video_id)"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="studio-cid">CID</Label>

          <Input
            id="studio-cid"
            value={cid}
            onChange={(event) => {
              onCidChange(event.target.value);
            }}
            placeholder="Content ID"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="studio-jancode">JAN code</Label>

          <Input
            id="studio-jancode"
            value={jancode}
            onChange={(event) => {
              onJancodeChange(event.target.value);
            }}
            placeholder="Barcode / JAN"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="studio-maker-product">Maker product</Label>

          <Input
            id="studio-maker-product"
            value={makerProduct}
            onChange={(event) => {
              onMakerProductChange(event.target.value);
            }}
            placeholder="Maker product code"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="studio-release-date">Release date</Label>

          <Popover open={releaseDateOpen} onOpenChange={setReleaseDateOpen} modal>
            <PopoverTrigger
              id="studio-release-date"
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
            >
              <span
                className={cn(
                  "truncate text-left transition-opacity",
                  selectedReleaseDate
                    ? "text-muted-foreground opacity-80 hover:opacity-100"
                    : "text-muted-foreground/70 opacity-80 hover:opacity-100",
                )}
              >
                {selectedReleaseDate ? format(selectedReleaseDate, "PPP") : "Pick a date"}
              </span>

              <CalendarIcon className="size-4 shrink-0 text-muted-foreground opacity-80" aria-hidden />
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0" side="bottom" align="start" sideOffset={4}>
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={selectedReleaseDate}
                defaultMonth={selectedReleaseDate}
                startMonth={new Date(1970, 0)}
                endMonth={new Date(new Date().getFullYear() + 2, 11)}
                onSelect={(date) => {
                  onReleaseDateChange(date ? formatReleaseDate(date) : "");
                  setReleaseDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Catalog relations</h3>

          <p className="text-muted-foreground text-xs">
            Link actresses, makers, genres, series, labels, and directors. Selections are saved to the catalog when the
            upload completes (or when you continue after resuming).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {RELATION_FILTERS.map((section) => (
            <div key={section.key} className="flex flex-col gap-2">
              <Label>{section.label}</Label>

              <EntityMultiFilter
                selected={relations[section.key]}
                onChange={(ids) => {
                  onRelationIdsChange(section.key, ids);
                }}
                config={section.config as unknown as EntityMultiFilterConfig}
                triggerClassName={(active) =>
                  cn(
                    "inline-flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 text-sm",
                    active
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )
                }
              />
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={notifySubscribers}
          onCheckedChange={(checked) => {
            onNotifySubscribersChange(checked === true);
          }}
        />

        <span>Notify your subscribers when this video goes live</span>
      </label>
    </div>
  );
}
