import { STEPS } from "@/layouts/video/studio/types";

export const SESSION_KEEPALIVE_CHECK_MS = 60 * 1000;
export const ACCESS_TOKEN_MIN_TTL_SECONDS = 120;

export function etagFromResponse(response: Response): string {
  const raw = response.headers.get("etag") ?? response.headers.get("ETag");

  if (!raw) {
    throw new Error("Upload part response missing ETag header.");
  }

  return raw;
}

export async function putPart(url: string, blob: Blob): Promise<string> {
  const response = await fetch(url, {
    method: "PUT",
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Part upload failed with status ${response.status}`);
  }

  return etagFromResponse(response);
}

export async function mapPool<TItem, TResult>(
  items: Array<TItem>,
  concurrency: number,
  worker: (item: TItem) => Promise<TResult>,
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function stepTitle(step: number): string {
  switch (step) {
    case 1:
      return "Upload your video";
    case 2:
      return "Add the finishing touches";
    case 3:
      return "Choose who can watch";
    case 4:
      return "Upload your video";
    case 5:
      return "Process your video";
    case 6:
      return "Add thumbnails and samples";
    case 7:
      return "Preview and publish";
    default:
      return "Studio";
  }
}

export function stepPercentComplete(activeStep: number): number {
  return Math.round(((activeStep - 1) / (STEPS.length - 1)) * 100);
}
