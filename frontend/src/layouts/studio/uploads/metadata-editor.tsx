import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { DetailsStep } from "@/layouts/studio/uploads/steps/details-step";
import type { RelationKey, RelationSelections } from "@/components/studio/types";
import { getApiErrorMessage } from "@/libs/auth";
import {
  updateVideoUploadMetadata,
  VIDEO_UPLOADS_LIST_QUERY_KEY,
  videoUploadStatusQueryKey,
  videoUploadStatusQueryOptions,
} from "@/queries/video-upload";
import type { VideoUploadStatusResponse } from "@/queries/video-upload";

function hydrateFromStatus(status: VideoUploadStatusResponse) {
  return {
    title: status.title ?? "",
    description: "",
    videoCode: status.video_id,
    cid: status.cid ?? "",
    jancode: status.jancode ?? "",
    makerProduct: status.maker_product ?? "",
    releaseDate:
      status.release_date != null && status.release_date.length >= 10 ? status.release_date.slice(0, 10) : "",
    relations: {
      actresses: status.actress_ids,
      makers: status.maker_ids,
      genres: status.genre_ids,
      series: status.series_ids,
      labels: status.label_ids,
      directors: status.director_ids,
    } satisfies RelationSelections,
  };
}

type UploadMetadataEditorProps = {
  uploadId: string;
  initialStatus: VideoUploadStatusResponse;
};

export function UploadMetadataEditor({ uploadId, initialStatus }: UploadMetadataEditorProps) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    ...videoUploadStatusQueryOptions(uploadId),
    initialData: initialStatus,
    queryKey: videoUploadStatusQueryKey(uploadId),
  });

  const status = statusQuery.data;
  const hydrated = hydrateFromStatus(status);

  const [title, setTitle] = useState(hydrated.title);
  const [description, setDescription] = useState(hydrated.description);
  const [videoCode, setVideoCode] = useState(hydrated.videoCode);
  const [cid, setCid] = useState(hydrated.cid);
  const [jancode, setJancode] = useState(hydrated.jancode);
  const [makerProduct, setMakerProduct] = useState(hydrated.makerProduct);
  const [releaseDate, setReleaseDate] = useState(hydrated.releaseDate);
  const [relations, setRelations] = useState<RelationSelections>(hydrated.relations);
  const [notifySubscribers, setNotifySubscribers] = useState(false);
  const [syncedPublicId, setSyncedPublicId] = useState(status.public_id);
  const [saving, setSaving] = useState(false);

  if (status.public_id !== syncedPublicId) {
    const next = hydrateFromStatus(status);
    setSyncedPublicId(status.public_id);
    setTitle(next.title);
    setDescription(next.description);
    setVideoCode(next.videoCode);
    setCid(next.cid);
    setJancode(next.jancode);
    setMakerProduct(next.makerProduct);
    setReleaseDate(next.releaseDate);
    setRelations(next.relations);
  }

  const onRelationIdsChange = useCallback((key: RelationKey, ids: Array<number>) => {
    setRelations((current) => ({ ...current, [key]: ids }));
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) {
      return;
    }

    if (!title.trim()) {
      toast.add({
        type: "error",
        title: "Title is required",
        description: "Enter a title before saving catalog details.",
        timeout: 4000,
      });

      return;
    }

    if (!videoCode.trim()) {
      toast.add({
        type: "error",
        title: "Video id is required",
        description: "Enter a video id before saving catalog details.",
        timeout: 4000,
      });

      return;
    }

    setSaving(true);

    try {
      const updated = await updateVideoUploadMetadata(status.public_id, {
        title: title.trim() || (status.title ?? undefined),
        video_id: videoCode.trim(),
        cid: cid.trim() || null,
        jancode: jancode.trim() || null,
        maker_product: makerProduct.trim() || null,
        release_date: releaseDate.trim() || null,
        actress_ids: relations.actresses,
        maker_ids: relations.makers,
        genre_ids: relations.genres,
        series_ids: relations.series,
        label_ids: relations.labels,
        director_ids: relations.directors,
      });

      queryClient.setQueryData(videoUploadStatusQueryKey(uploadId), updated);
      void queryClient.invalidateQueries({ queryKey: VIDEO_UPLOADS_LIST_QUERY_KEY });
      toast.add({
        type: "success",
        title: "Metadata saved",
        description: "Catalog details were updated successfully.",
        timeout: 4000,
      });
    } catch (saveError) {
      toast.add({
        type: "error",
        title: "Could not save metadata",
        description: getApiErrorMessage(saveError),
        timeout: 4000,
      });
    } finally {
      setSaving(false);
    }
  }, [cid, jancode, makerProduct, queryClient, relations, releaseDate, saving, status, title, uploadId, videoCode]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Metadata</h1>

          <p className="text-muted-foreground text-sm">
            Edit title, video id, catalog fields, and relations for {status.video_id}.
          </p>
        </div>

        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <section className="bg-card rounded-xl border p-5 sm:p-6">
        <DetailsStep
          title={title}
          description={description}
          videoCode={videoCode}
          cid={cid}
          jancode={jancode}
          makerProduct={makerProduct}
          releaseDate={releaseDate}
          relations={relations}
          notifySubscribers={notifySubscribers}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onVideoCodeChange={setVideoCode}
          onCidChange={setCid}
          onJancodeChange={setJancode}
          onMakerProductChange={setMakerProduct}
          onReleaseDateChange={setReleaseDate}
          onRelationIdsChange={onRelationIdsChange}
          onNotifySubscribersChange={setNotifySubscribers}
        />
      </section>
    </div>
  );
}

export function UploadMetadataEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading metadata">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <section className="bg-card flex flex-col gap-4 rounded-xl border p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </section>
    </div>
  );
}
