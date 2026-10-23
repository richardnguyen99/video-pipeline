import { Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RELATION_KEYS } from "@/layouts/video/studio/types";
import type { StudioPreviewModel } from "@/layouts/video/studio/types";

const RELATION_LABELS: Record<(typeof RELATION_KEYS)[number], string> = {
  actresses: "Actresses",
  makers: "Makers",
  genres: "Genres",
  series: "Series",
  labels: "Labels",
  directors: "Directors",
};

type PreviewStepProps = {
  model: StudioPreviewModel;
};

export function PreviewStep({ model }: PreviewStepProps) {
  const {
    fileName,
    title,
    description,
    videoCode,
    cid,
    jancode,
    makerProduct,
    releaseDate,
    visibility,
    notifySubscribers,
    relations,
    status,
  } = model;

  return (
    <div className="flex w-full flex-col gap-4 py-2">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-full">
          <Check className="size-6" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-base font-medium">Preview and publish</h3>

          <p className="text-muted-foreground text-sm">
            Review title, visibility, and encoding status. Open the video page to watch the HLS stream when processing
            has finished.
          </p>
        </div>
      </div>

      {status != null ? (
        <div className="bg-muted/40 flex w-full flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Catalog page</span>

            <span className="font-medium">{title.trim() || status.title || "Untitled video"}</span>

            <span className="text-muted-foreground font-mono text-xs">/videos/{status.id}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            nativeButton={false}
            render={<Link to="/videos/$id" params={{ id: String(status.id) }} />}
          >
            Open video page
            <ExternalLink data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      ) : null}

      <dl className="bg-muted/40 grid w-full gap-3 rounded-lg border p-4 text-left text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <dt className="text-muted-foreground text-xs">File</dt>

          <dd className="font-medium break-all">{fileName ?? "Selected video"}</dd>
        </div>

        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <dt className="text-muted-foreground text-xs">Title</dt>

          <dd className="font-medium">{title.trim() || "Untitled video"}</dd>
        </div>

        {videoCode.trim() ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Video code</dt>

            <dd className="font-medium">{videoCode.trim()}</dd>
          </div>
        ) : null}

        {cid.trim() ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">CID</dt>

            <dd className="font-medium">{cid.trim()}</dd>
          </div>
        ) : null}

        {jancode.trim() ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">JAN code</dt>

            <dd className="font-medium">{jancode.trim()}</dd>
          </div>
        ) : null}

        {makerProduct.trim() ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Maker product</dt>

            <dd className="font-medium">{makerProduct.trim()}</dd>
          </div>
        ) : null}

        {releaseDate ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Release date</dt>

            <dd className="font-medium">{releaseDate}</dd>
          </div>
        ) : null}

        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Visibility</dt>

          <dd className="font-medium capitalize">{visibility}</dd>
        </div>

        {status ? (
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <dt className="text-muted-foreground text-xs">Upload status</dt>

            <dd className="font-medium">
              {status.status}

              {status.public_id ? (
                <span className="text-muted-foreground mt-0.5 block font-mono text-xs">{status.public_id}</span>
              ) : null}
            </dd>
          </div>
        ) : null}

        {description.trim() ? (
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <dt className="text-muted-foreground text-xs">Description</dt>

            <dd className="text-muted-foreground whitespace-pre-wrap">{description}</dd>
          </div>
        ) : null}

        {RELATION_KEYS.map((key) => {
          const ids = relations[key];

          if (ids.length === 0) {
            return null;
          }

          return (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">{RELATION_LABELS[key]}</dt>

              <dd className="font-medium tabular-nums">{ids.length} selected</dd>
            </div>
          );
        })}

        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Notify subscribers</dt>

          <dd className="font-medium">{notifySubscribers ? "Yes" : "No"}</dd>
        </div>
      </dl>
    </div>
  );
}
