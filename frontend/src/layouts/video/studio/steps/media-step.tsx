import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getApiErrorMessage } from "@/libs/auth";
import { cn } from "@/libs/utils";
import {
  deleteVideoSample,
  deleteVideoThumbnail,
  listVideoUploadMedia,
  uploadVideoSamples,
  uploadVideoThumbnail,
} from "@/queries/video-upload";
import type {
  SampleImageType,
  ThumbnailImageType,
  VideoMediaImageItem,
  VideoMediaResponse,
} from "@/queries/video-upload";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

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

type SectionMessage = {
  tone: "success" | "error";
  title: string;
  description: string;
};

function latestByType(items: Array<VideoMediaImageItem>, type: string): VideoMediaImageItem | null {
  const matches = items.filter((item) => item.type === type);

  if (matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1] ?? null;
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

function filterImageFiles(files: FileList | Array<File> | null): Array<File> {
  if (files == null) {
    return [];
  }

  return Array.from(files).filter(isImageFile);
}

const THUMBNAIL_MESSAGE_KEY = "thumbnails";

function thumbZoneKey(type: ThumbnailImageType): string {
  return `thumb-${type}`;
}

function sampleZoneKey(type: SampleImageType): string {
  return `sample-${type}`;
}

function SectionAlert({ message, onDismiss }: { message: SectionMessage; onDismiss: () => void }) {
  const isError = message.tone === "error";

  return (
    <Alert
      className={cn(
        isError
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-success bg-success/10 text-success-foreground",
      )}
    >
      {isError ? <AlertCircle /> : <CheckCircle2 />}

      <AlertTitle>{message.title}</AlertTitle>

      <AlertDescription className={cn(isError ? "text-destructive/90" : "text-success-foreground/90")}>
        {message.description}
      </AlertDescription>

      <AlertAction>
        <button
          type="button"
          aria-label="Dismiss alert"
          className="rounded-md p-1 text-current/70 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </button>
      </AlertAction>
    </Alert>
  );
}

export function MediaStep({ publicId }: MediaStepProps) {
  const [media, setMedia] = useState<VideoMediaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Partial<Record<string, SectionMessage>>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const thumbInputRefs = useRef<Partial<Record<ThumbnailImageType, HTMLInputElement | null>>>({});
  const sampleInputRefs = useRef<Partial<Record<SampleImageType, HTMLInputElement | null>>>({});

  const setSectionMessage = (key: string, message: SectionMessage | null) => {
    setMessages((prev) => {
      if (message == null) {
        if (prev[key] == null) {
          return prev;
        }

        const next = { ...prev };
        delete next[key];

        return next;
      }

      return { ...prev, [key]: message };
    });
  };

  useEffect(() => {
    if (publicId == null) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const next = await listVideoUploadMedia(publicId);

        if (!cancelled) {
          setMedia(next);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error));
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

  const uploadThumbnail = async (imageType: ThumbnailImageType, file: File) => {
    const zoneKey = thumbZoneKey(imageType);

    setBusyKey(zoneKey);
    setSectionMessage(THUMBNAIL_MESSAGE_KEY, null);

    try {
      const next = await uploadVideoThumbnail(publicId, imageType, file);
      setMedia(next);
      setSectionMessage(THUMBNAIL_MESSAGE_KEY, {
        tone: "success",
        title: "Thumbnail saved",
        description: `${imageType} thumbnail was uploaded successfully.`,
      });
    } catch (error) {
      setSectionMessage(THUMBNAIL_MESSAGE_KEY, {
        tone: "error",
        title: "Thumbnail upload failed",
        description: getApiErrorMessage(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const uploadSamples = async (imageType: SampleImageType, files: Array<File>) => {
    if (files.length === 0) {
      return;
    }

    const zoneKey = sampleZoneKey(imageType);

    setBusyKey(zoneKey);
    setSectionMessage(zoneKey, null);

    try {
      const next = await uploadVideoSamples(publicId, imageType, files);
      setMedia(next);
      setSectionMessage(zoneKey, {
        tone: "success",
        title: "Samples saved",
        description:
          files.length === 1
            ? "1 sample image was uploaded successfully."
            : `${files.length} sample images were uploaded successfully.`,
      });
    } catch (error) {
      setSectionMessage(zoneKey, {
        tone: "error",
        title: "Sample upload failed",
        description: getApiErrorMessage(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const onThumbnailChange = async (imageType: ThumbnailImageType, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file == null || !isImageFile(file)) {
      return;
    }

    await uploadThumbnail(imageType, file);
  };

  const onSamplesChange = async (imageType: SampleImageType, event: ChangeEvent<HTMLInputElement>) => {
    const files = filterImageFiles(event.target.files);
    event.target.value = "";

    await uploadSamples(imageType, files);
  };

  const onDeleteThumbnail = async (imageType: ThumbnailImageType) => {
    const zoneKey = thumbZoneKey(imageType);

    setBusyKey(`delete-${zoneKey}`);
    setSectionMessage(THUMBNAIL_MESSAGE_KEY, null);

    try {
      const next = await deleteVideoThumbnail(publicId, imageType);
      setMedia(next);
      setSectionMessage(THUMBNAIL_MESSAGE_KEY, {
        tone: "success",
        title: "Thumbnail removed",
        description: `${imageType} thumbnail was deleted.`,
      });
    } catch (error) {
      setSectionMessage(THUMBNAIL_MESSAGE_KEY, {
        tone: "error",
        title: "Delete failed",
        description: getApiErrorMessage(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const onDeleteSample = async (imageType: SampleImageType, sampleId: number) => {
    const zoneKey = sampleZoneKey(imageType);

    setBusyKey(`delete-sample-${sampleId}`);
    setSectionMessage(zoneKey, null);

    try {
      const next = await deleteVideoSample(publicId, sampleId);
      setMedia(next);
      setSectionMessage(zoneKey, {
        tone: "success",
        title: "Sample removed",
        description: "The sample image was deleted.",
      });
    } catch (error) {
      setSectionMessage(zoneKey, {
        tone: "error",
        title: "Delete failed",
        description: getApiErrorMessage(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const onThumbDrop = (imageType: ThumbnailImageType, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragKey(null);

    if (busyKey != null) {
      return;
    }

    const file = filterImageFiles(event.dataTransfer.files)[0];
    void uploadThumbnail(imageType, file);
  };

  const onSampleDrop = (imageType: SampleImageType, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragKey(null);

    if (busyKey != null) {
      return;
    }

    void uploadSamples(imageType, filterImageFiles(event.dataTransfer.files));
  };

  const onDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>, open: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  const thumbnailMessage = messages[THUMBNAIL_MESSAGE_KEY];

  return (
    <div className="flex w-full flex-col gap-6 py-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">Thumbnails and sample images</h3>

        <p className="text-muted-foreground text-sm">
          Optional. Drag and drop images onto a zone, or click to browse. Files are stored under the video&apos;s object
          prefix (<span className="font-mono text-xs">thumbnails/</span>,{" "}
          <span className="font-mono text-xs">samples/</span>) and linked in the catalog tables. You can skip this step
          and continue.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading existing media…
        </div>
      ) : null}

      {loadError ? (
        <Alert className="border-destructive bg-destructive/10 text-destructive">
          <AlertCircle />

          <AlertTitle>Could not load media</AlertTitle>

          <AlertDescription className="text-destructive/90">{loadError}</AlertDescription>

          <AlertAction>
            <button
              type="button"
              aria-label="Dismiss alert"
              className="rounded-md p-1 text-current/70 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
              onClick={() => {
                setLoadError(null);
              }}
            >
              <X className="size-4" />
            </button>
          </AlertAction>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-medium">Catalog thumbnails</h4>

        {thumbnailMessage != null ? (
          <SectionAlert
            message={thumbnailMessage}
            onDismiss={() => {
              setSectionMessage(THUMBNAIL_MESSAGE_KEY, null);
            }}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {THUMBNAIL_TYPES.map((entry) => {
            const current = latestByType(media?.thumbnails ?? [], entry.type);
            const zoneKey = thumbZoneKey(entry.type);
            const deleteKey = `delete-${zoneKey}`;
            const busy = busyKey === zoneKey || busyKey === deleteKey;
            const deleting = busyKey === deleteKey;
            const dragging = dragKey === zoneKey;

            return (
              <div key={entry.type} className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <Label>{entry.label}</Label>

                  <span className="text-muted-foreground text-xs">{entry.hint}</span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${current ? "Replace" : "Upload"} ${entry.label} thumbnail`}
                  className={cn(
                    "relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors",
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30",
                    busy && "pointer-events-none opacity-60",
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragKey(zoneKey);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDragLeave={() => {
                    setDragKey((prev) => (prev === zoneKey ? null : prev));
                  }}
                  onDrop={(event) => {
                    onThumbDrop(entry.type, event);
                  }}
                  onClick={() => {
                    thumbInputRefs.current[entry.type]?.click();
                  }}
                  onKeyDown={(event) => {
                    onDropzoneKeyDown(event, () => {
                      thumbInputRefs.current[entry.type]?.click();
                    });
                  }}
                >
                  {current ? (
                    <img
                      src={current.url}
                      alt={`${entry.label} thumbnail`}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex aspect-video w-full flex-col items-center justify-center gap-2 px-3 py-6">
                      {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}

                      <span className="text-center text-xs">
                        {busy ? "Uploading…" : dragging ? "Drop image here" : "Drop or click to upload"}
                      </span>
                    </div>
                  )}

                  {current && busy ? (
                    <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                  ) : null}

                  {current && !busy ? (
                    <div className="bg-background/80 text-muted-foreground absolute inset-x-0 bottom-0 px-2 py-1 text-center text-[11px]">
                      {dragging ? "Drop to replace" : "Drop or click to replace"}
                    </div>
                  ) : null}

                  {current ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="absolute top-1 right-1 z-10 size-7 shadow-sm pointer-events-auto"
                      disabled={busyKey != null}
                      aria-label={`Remove ${entry.label} thumbnail`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDeleteThumbnail(entry.type);
                      }}
                    >
                      {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                    </Button>
                  ) : null}

                  <input
                    ref={(node) => {
                      thumbInputRefs.current[entry.type] = node;
                    }}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    disabled={busy}
                    onChange={(event) => {
                      void onThumbnailChange(entry.type, event);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-medium">Sample review images</h4>

        {SAMPLE_TYPES.map((entry) => {
          const items = (media?.samples ?? []).filter((item) => item.type === entry.type);
          const zoneKey = sampleZoneKey(entry.type);
          const busy = busyKey === zoneKey;
          const dragging = dragKey === zoneKey;
          const message = messages[zoneKey];

          return (
            <div key={entry.type} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-col gap-0.5">
                <Label>{entry.label}</Label>

                <span className="text-muted-foreground text-xs">{entry.hint}</span>
              </div>

              {message ? (
                <SectionAlert
                  message={message}
                  onDismiss={() => {
                    setSectionMessage(zoneKey, null);
                  }}
                />
              ) : null}

              <div
                role="button"
                tabIndex={0}
                aria-label={`Add ${entry.label} images`}
                className={cn(
                  "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                  busy && "pointer-events-none opacity-60",
                )}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragKey(zoneKey);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDragLeave={() => {
                  setDragKey((prev) => (prev === zoneKey ? null : prev));
                }}
                onDrop={(event) => {
                  onSampleDrop(entry.type, event);
                }}
                onClick={() => {
                  sampleInputRefs.current[entry.type]?.click();
                }}
                onKeyDown={(event) => {
                  onDropzoneKeyDown(event, () => {
                    sampleInputRefs.current[entry.type]?.click();
                  });
                }}
              >
                {busy ? (
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                ) : (
                  <ImagePlus className="text-muted-foreground size-5" />
                )}

                <span className="text-muted-foreground text-center text-xs">
                  {busy ? "Uploading…" : dragging ? "Drop images here" : "Drop images here, or click to browse"}
                </span>

                <input
                  ref={(node) => {
                    sampleInputRefs.current[entry.type] = node;
                  }}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => {
                    void onSamplesChange(entry.type, event);
                  }}
                />
              </div>

              {items.length > 0 ? (
                <ScrollArea className="h-52 w-full rounded-md border">
                  <div className="flex flex-wrap items-start gap-2 p-2">
                    {items.map((item) => {
                      const deleting = busyKey === `delete-sample-${item.id}`;

                      return (
                        <div key={item.id} className="relative inline-flex">
                          <img
                            src={item.url}
                            alt={`${entry.label} ${item.id}`}
                            className="bg-muted h-36 w-auto max-w-full rounded-md object-contain sm:h-40"
                          />

                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            className="absolute top-1 right-1 size-7 shadow-sm"
                            disabled={deleting || busyKey != null}
                            aria-label={`Remove sample image ${item.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void onDeleteSample(entry.type, item.id);
                            }}
                          >
                            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
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
