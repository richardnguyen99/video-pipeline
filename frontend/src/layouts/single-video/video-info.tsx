import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { EntityTag } from "@/components/video/entity-tag";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { actressDisplayName, normalizeVideoEntities, pickActressImageUrl, videoDisplayTitle } from "@/mocks/videos";
import type { ActressRef, NamedEntity, Video } from "@/mocks/videos";
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

function CollapsibleEntityList<T extends NamedEntity>({
  items,
  renderItem,
  emptyLabel = "—",
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const needsCollapse = items.length > PREVIEW_COUNT;
  const rest = items.slice(PREVIEW_COUNT);

  if (items.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  if (!needsCollapse) {
    return <ul className="flex flex-wrap gap-2">{items.map(renderItem)}</ul>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span key={item.id} className={open || index < PREVIEW_COUNT ? "contents" : "hidden"}>
            {renderItem(item)}
          </span>
        ))}
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
  const actresses: ActressRef[] = video.actresses ?? [];
  const genres = video.genres ?? [];
  const makers = normalizeVideoEntities(video.makers, video.maker);
  const labels = normalizeVideoEntities(video.labels, video.label);
  const directors = normalizeVideoEntities(video.directors, video.director);
  const series = normalizeVideoEntities(video.series);

  return (
    <section className="mt-8" aria-label="Video information">
      <h3 className="mb-4 text-lg font-semibold">Info</h3>
      <dl className="flex flex-col gap-3">
        <InfoRow label="Release date">{formatReleaseDate(video.release_date)}</InfoRow>
        <InfoRow label="Code">
          <span className="font-mono">{code}</span>
        </InfoRow>
        <InfoRow label="Title">{videoDisplayTitle(video)}</InfoRow>
        <InfoRow label="Maker">
          <CollapsibleEntityList
            key={`makers-${video.id}`}
            items={makers}
            renderItem={(item) => <EntityTag key={item.id} entity={item} filter="maker" />}
          />
        </InfoRow>
        <InfoRow label="Label">
          <CollapsibleEntityList
            key={`labels-${video.id}`}
            items={labels}
            renderItem={(item) => <EntityTag key={item.id} entity={item} filter="label" />}
          />
        </InfoRow>
        <InfoRow label="Director">
          <CollapsibleEntityList
            key={`directors-${video.id}`}
            items={directors}
            renderItem={(item) => <EntityTag key={item.id} entity={item} filter="director" />}
          />
        </InfoRow>
        <InfoRow label="Series">
          <CollapsibleEntityList
            key={`series-${video.id}`}
            items={series}
            renderItem={(item) => <EntityTag key={item.id} entity={item} filter="series" />}
          />
        </InfoRow>
        <InfoRow label="Actresses">
          <CollapsibleEntityList
            key={`actresses-${video.id}`}
            items={actresses}
            renderItem={(item) => (
              <EntityTag
                key={item.id}
                entity={{ id: item.id, name: actressDisplayName(item) }}
                to={`/actresses/${item.id}`}
                imageUrl={pickActressImageUrl(item.actress_image) ?? item.image_url ?? null}
              />
            )}
          />
        </InfoRow>
        <InfoRow label="Genres">
          <CollapsibleEntityList
            key={`genres-${video.id}`}
            items={genres}
            renderItem={(item) => <EntityTag key={item.id} entity={item} filter="genre" />}
          />
        </InfoRow>
      </dl>
    </section>
  );
}
