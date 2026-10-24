import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/libs/auth";
import { cn } from "@/libs/utils";
import { listVideoUploadMedia, uploadVideoSamples, uploadVideoThumbnail } from "@/queries/video-upload";
import type {
  SampleImageType,
  ThumbnailImageType,
  VideoMediaImageItem,
  VideoMediaResponse,
} from "@/queries/video-upload";

const THUMBNAIL_TYPES: Array<{ type: ThumbnailImageType; label: string; hint: string }> = [
  { type: "large", label: "Large", hint: "Primary cover (pl)" },
  { type: "list", label: "List", hint: "List / card (pt)" },
  { type: "small", label: "Small", hint: "Compact (ps)" },
];

const SAMPLE_TYPES: Array<{ type: SampleImageType; label: string; hint: string }> = [
  { type: "sample_s", label: "Sample (small)", hint: "sample_s review stills" },
  { type: "sample_l", label: "Sample (large)", hint: "sample_l review stills" },
];

type MediaStepProps = {
  publicId: string | null;
};

function latestByType(items: Array<VideoMediaImageItem>, type: string): VideoMediaImageItem | null {
  const matches = items.filter((item) => item.type === type);

  if (matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1] ?? null;
}

export function MediaStep({ publicId }: MediaStepProps) {
  const [media, setMedia] = useState<VideoMediaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (publicId == null) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const next = await listVideoUploadMedia(publicId);

        if (!cancelled) {
          setMedia(next);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  if (publicId == null) {
    return (
      <p className="text-muted-foreground text-sm">Finish the upload step before attaching thumbnails and samples.</p>
    );
  }

  const onThumbnailChange = async (imageType: ThumbnailImageType, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file == null) {
      return;
    }

    setBusyKey(`thumb-${imageType}`);
    setError(null);

    try {
      const next = await uploadVideoThumbnail(publicId, imageType, file);
      setMedia(next);
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setBusyKey(null);
    }
  };

  const onSamplesChange = async (imageType: SampleImageType, event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    event.target.value = "";

    if (list == null || list.length === 0) {
      return;
    }

    setBusyKey(`sample-${imageType}`);
    setError(null);

    try {
      const next = await uploadVideoSamples(publicId, imageType, Array.from(list));
      setMedia(next);
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 py-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">Thumbnails and sample images</h3>

        <p className="text-muted-foreground text-sm">
          Optional. Files are stored under the video&apos;s object prefix (
          <span className="font-mono text-xs">thumbnails/</span>, <span className="font-mono text-xs">samples/</span>)
          and linked in the catalog tables. You can skip this step and continue.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading existing media…
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-medium">Catalog thumbnails</h4>

        <div className="grid gap-3 sm:grid-cols-3">
          {THUMBNAIL_TYPES.map((entry) => {
            const current = latestByType(media?.thumbnails ?? [], entry.type);
            const inputId = `thumb-${entry.type}`;
            const busy = busyKey === `thumb-${entry.type}`;

            return (
              <div key={entry.type} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={inputId}>{entry.label}</Label>

                  <span className="text-muted-foreground text-xs">{entry.hint}</span>
                </div>

                {current ? (
                  <img
                    src={current.url}
                    alt={`${entry.label} thumbnail`}
                    className="aspect-video w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex aspect-video items-center justify-center rounded-md">
                    <ImagePlus className="size-5" />
                  </div>
                )}

                <label
                  htmlFor={inputId}
                  className={cn(
                    "border-input bg-background hover:bg-accent inline-flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-xs font-medium",
                    busy && "pointer-events-none opacity-50",
                  )}
                >
                  {busy ? "Uploading…" : current ? "Replace" : "Upload"}
                </label>

                <input
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => {
                    void onThumbnailChange(entry.type, event);
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-medium">Sample review images</h4>

        {SAMPLE_TYPES.map((entry) => {
          const items = (media?.samples ?? []).filter((item) => item.type === entry.type);
          const inputId = `sample-${entry.type}`;
          const busy = busyKey === `sample-${entry.type}`;

          return (
            <div key={entry.type} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={inputId}>{entry.label}</Label>

                  <span className="text-muted-foreground text-xs">{entry.hint}</span>
                </div>

                <label
                  htmlFor={inputId}
                  className={cn(
                    "border-input bg-background hover:bg-accent inline-flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-xs font-medium",
                    busy && "pointer-events-none opacity-50",
                  )}
                >
                  {busy ? "Uploading…" : "Add images"}
                </label>

                <input
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => {
                    void onSamplesChange(entry.type, event);
                  }}
                />
              </div>

              {items.length > 0 ? (
                <div className="flex flex-wrap items-start gap-2">
                  {items.map((item) => (
                    <img
                      key={item.id}
                      src={item.url}
                      alt={`${entry.label} ${item.id}`}
                      className="bg-muted h-36 w-auto max-w-full rounded-md object-contain sm:h-44"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">No images yet.</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
