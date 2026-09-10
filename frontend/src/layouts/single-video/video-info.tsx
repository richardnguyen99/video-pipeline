import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { ActressTag } from "@/components/video/actress-tag";
import { EntityLink } from "@/components/video/entity-link";
import { GenreTag } from "@/components/video/genre-tag";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { NamedEntity, Video } from "@/mocks/videos";
import { formatReleaseDate } from "@/libs/utils";

interface VideoInfoProps {
  video: Video;
}

const PREVIEW_COUNT = 4;

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="pt-0.5 font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function CollapsibleEntityList({
  items,
  renderItem,
  emptyLabel = "—",
}: {
  items: NamedEntity[];
  renderItem: (item: NamedEntity) => ReactNode;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const needsCollapse = items.length > PREVIEW_COUNT;
  const preview = items.slice(0, PREVIEW_COUNT);
  const rest = items.slice(PREVIEW_COUNT);

  if (items.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  if (!needsCollapse) {
    return <ul className="flex flex-wrap gap-2">{items.map(renderItem)}</ul>;
  }

  const visible = open ? items : preview;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <ul className="flex flex-wrap gap-2">
        {visible.map(renderItem)}
        <li className="flex items-center">
          <CollapsibleTrigger
            className={
              open
                ? "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                : "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }
          >
            {open ? (
              <>
                Show less
                <ChevronDown className="size-3.5 rotate-180" />
              </>
            ) : (
              <>
                +{rest.length} more
                <ChevronDown className="size-3.5" />
              </>
            )}
          </CollapsibleTrigger>
        </li>
      </ul>
      <CollapsibleContent className="hidden" />
    </Collapsible>
  );
}

export function VideoInfo({ video }: VideoInfoProps) {
  const code = video.cid ?? video.video_id;
  const actresses = video.actresses ?? [];
  const genres = video.genres ?? [];

  return (
    <section className="mt-8" aria-label="Video information">
      <h3 className="mb-4 text-lg font-semibold">Info</h3>
      <dl className="flex flex-col gap-3">
        <InfoRow label="Release date">{formatReleaseDate(video.release_date)}</InfoRow>
        <InfoRow label="Code">
          <span className="font-mono">{code}</span>
        </InfoRow>
        <InfoRow label="Title">{video.title}</InfoRow>
        <InfoRow label="Maker">
          {video.maker ? (
            <EntityLink to={`/makers/${video.maker.id}`} variant="single">
              {video.maker.name}
            </EntityLink>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoRow>
        <InfoRow label="Label">
          {video.label ? (
            <EntityLink to={`/labels/${video.label.id}`} variant="single">
              {video.label.name}
            </EntityLink>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoRow>
        <InfoRow label="Director">
          {video.director ? (
            <EntityLink to={`/directors/${video.director.id}`} variant="single">
              {video.director.name}
            </EntityLink>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoRow>
        <InfoRow label="Actresses">
          <CollapsibleEntityList items={actresses} renderItem={(item) => <ActressTag key={item.id} actress={item} />} />
        </InfoRow>
        <InfoRow label="Genres">
          <CollapsibleEntityList items={genres} renderItem={(item) => <GenreTag key={item.id} genre={item} />} />
        </InfoRow>
      </dl>
    </section>
  );
}
