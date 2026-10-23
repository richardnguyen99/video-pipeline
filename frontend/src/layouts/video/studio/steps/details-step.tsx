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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RelationKey, RelationSelections } from "@/layouts/video/studio/types";

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

          <Input
            id="studio-release-date"
            type="date"
            value={releaseDate}
            onChange={(event) => {
              onReleaseDateChange(event.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Catalog relations</h3>

          <p className="text-muted-foreground text-xs">
            Link actresses, makers, genres, series, labels, and directors. Relation IDs are kept for publish; catalog
            write APIs are not connected in this skeleton.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {RELATION_FILTERS.map((section) => (
            <div key={section.key} className="flex flex-col gap-2">
              <Label>{section.label}</Label>

              <EntityMultiFilter
                selected={relations[section.key]}
                onChange={(ids) => {
                  onRelationIdsChange(section.key, ids);
                }}
                config={section.config as unknown as EntityMultiFilterConfig}
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
