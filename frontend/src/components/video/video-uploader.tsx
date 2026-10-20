import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ApiError, ensureFreshAccessToken } from "@/libs/api-client";
import { HttpStatus } from "@/libs/http-status";
import {
  completeVideoUpload,
  createVideoUpload,
  DEFAULT_PART_SIZE_BYTES,
  MAX_PARALLEL_PARTS,
  presignVideoUploadParts,
} from "@/queries/video-upload";
import type { CompletedPart, VideoUploadStatusResponse } from "@/queries/video-upload";

type UploadPhase = "idle" | "preparing" | "uploading" | "completing" | "done" | "error";

type VideoUploaderProps = {
  onCompleted?: (status: VideoUploadStatusResponse) => void;
};

/** How often to check whether the access token needs a quiet refresh. */
const SESSION_KEEPALIVE_CHECK_MS = 60 * 1000;

/** Refresh only when fewer than this many seconds remain on the access JWT. */
const ACCESS_TOKEN_MIN_TTL_SECONDS = 120;

function etagFromResponse(response: Response): string {
  const raw = response.headers.get("etag") ?? response.headers.get("ETag");

  if (!raw) {
    throw new Error("Upload part response missing ETag header.");
  }

  return raw;
}

async function putPart(url: string, blob: Blob): Promise<string> {
  const response = await fetch(url, {
    method: "PUT",
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Part upload failed with status ${response.status}`);
  }

  return etagFromResponse(response);
}

async function mapPool<T, TResult>(
  items: Array<T>,
  concurrency: number,
  worker: (item: T) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results: Array<TResult> = new Array(items.length);
  let nextIndex = 0;

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);

  return results;
}

export function VideoUploader({ onCompleted }: VideoUploaderProps) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progressPct, setProgressPct] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoUploadStatusResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgressPct(0);
    setMessage(null);
    setStatus(null);
    setFileName(null);
  }, []);

  const onFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      setFileName(file.name);
      setPhase("preparing");
      setProgressPct(0);
      setMessage(null);
      setStatus(null);

      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      try {
        const created = await createVideoUpload({
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          title: file.name.replace(/\.[^.]+$/, ""),
          part_size_bytes: DEFAULT_PART_SIZE_BYTES,
        });

        setPhase("uploading");

        keepaliveTimer = setInterval(() => {
          void ensureFreshAccessToken(ACCESS_TOKEN_MIN_TTL_SECONDS);
        }, SESSION_KEEPALIVE_CHECK_MS);

        const partCount = created.part_count;
        const partSize = created.part_size_bytes;
        const partNumbers = Array.from({ length: partCount }, (_, index) => index + 1);

        const urlByPart = new Map<number, string>(created.parts.map((part) => [part.part_number, part.url]));

        const missing = partNumbers.filter((n) => !urlByPart.has(n));

        if (missing.length > 0) {
          const extra = await presignVideoUploadParts(created.public_id, created.multipart_upload_id, missing);

          for (const part of extra) {
            urlByPart.set(part.part_number, part.url);
          }
        }

        let finishedBytes = 0;
        const completed: Array<CompletedPart> = await mapPool(partNumbers, MAX_PARALLEL_PARTS, async (partNumber) => {
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const blob = file.slice(start, end);
          let url = urlByPart.get(partNumber);

          if (!url) {
            const [refreshed] = await presignVideoUploadParts(created.public_id, created.multipart_upload_id, [
              partNumber,
            ]);
            url = refreshed.url;
            urlByPart.set(partNumber, url);
          }

          const etag = await putPart(url, blob);
          finishedBytes += blob.size;
          setProgressPct(Math.min(99, Math.round((finishedBytes / file.size) * 100)));

          return { part_number: partNumber, etag };
        });

        setPhase("completing");
        setProgressPct(99);

        const accessToken = await ensureFreshAccessToken(ACCESS_TOKEN_MIN_TTL_SECONDS);

        if (accessToken === null) {
          throw new Error(
            "Session expired during upload. Sign in again, then retry. " +
              "Uploaded parts may still be in object storage until completed.",
          );
        }

        const orderedParts = completed.sort((a, b) => a.part_number - b.part_number);
        let finalStatus: VideoUploadStatusResponse;

        try {
          finalStatus = await completeVideoUpload(created.public_id, created.multipart_upload_id, orderedParts);
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== HttpStatus.UNAUTHORIZED) {
            throw error;
          }

          const retried = await ensureFreshAccessToken(0);

          if (retried === null) {
            throw new Error("Session expired while completing the upload. Sign in again and retry.", { cause: error });
          }

          finalStatus = await completeVideoUpload(created.public_id, created.multipart_upload_id, orderedParts);
        }

        setStatus(finalStatus);
        setPhase("done");
        setProgressPct(100);
        setMessage(`Uploaded. Status: ${finalStatus.status}`);
        onCompleted?.(finalStatus);
      } catch (error) {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        if (keepaliveTimer != null) {
          clearInterval(keepaliveTimer);
        }
      }
    },
    [onCompleted],
  );

  const busy = phase === "preparing" || phase === "uploading" || phase === "completing";

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="video-upload-input">
          Select MP4 or MKV
        </label>

        <input
          id="video-upload-input"
          type="file"
          accept="video/mp4,video/x-matroska,.mp4,.mkv,.mov,.webm"
          disabled={busy}
          onChange={onFileChange}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </div>

      {fileName ? <p className="text-muted-foreground text-sm truncate">{fileName}</p> : null}

      {phase !== "idle" ? (
        <div className="flex flex-col gap-2">
          <Progress value={progressPct} />

          <p className="text-sm">
            {phase === "preparing" && "Creating upload session…"}
            {phase === "uploading" && `Uploading… ${progressPct}%`}
            {phase === "completing" && "Finalizing upload…"}
            {phase === "done" && "Upload complete"}
            {phase === "error" && "Upload failed"}
          </p>
        </div>
      ) : null}

      {message ? (
        <p
          className={phase === "error" ? "text-sm text-destructive" : "text-sm text-emerald-600 dark:text-emerald-400"}
        >
          {message}
        </p>
      ) : null}

      {status ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Public id</dt>
          <dd className="font-mono text-xs break-all">{status.public_id}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{status.status}</dd>
          <dt className="text-muted-foreground">Bytes</dt>
          <dd>{status.source_bytes ?? "—"}</dd>
        </dl>
      ) : null}

      {(phase === "done" || phase === "error") && (
        <Button type="button" variant="outline" onClick={reset}>
          Upload another
        </Button>
      )}
    </div>
  );
}
