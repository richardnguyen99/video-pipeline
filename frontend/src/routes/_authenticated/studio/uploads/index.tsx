import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { UploadsList } from "@/layouts/video/studio/uploads-list";

const uploadsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/studio/uploads/")({
  ssr: true,
  validateSearch: uploadsSearchSchema,
  component: StudioUploadsListPage,
});

function StudioUploadsListPage() {
  const { q } = Route.useSearch();

  return (
    <main className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Uploads</h1>

        <p className="text-muted-foreground text-sm">Resume in-progress work or open a finished catalog entry.</p>
      </div>

      <UploadsList initialQuery={q ?? ""} />
    </main>
  );
}
