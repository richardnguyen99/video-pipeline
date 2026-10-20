import { createFileRoute } from "@tanstack/react-router";

import { VideoUploader } from "@/components/video/video-uploader";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload video</h1>

        <p className="text-muted-foreground text-sm">
          Files are uploaded directly to object storage with multipart presigned URLs. Encoding is not started in this
          skeleton.
        </p>
      </div>

      <VideoUploader />
    </main>
  );
}
