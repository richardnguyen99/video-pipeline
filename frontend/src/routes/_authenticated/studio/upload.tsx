import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const studioUploadSearchSchema = z.object({
  publicId: z.uuid().optional().catch(undefined),
  step: z.coerce.number().int().min(1).max(7).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/studio/upload")({
  validateSearch: studioUploadSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/upload",
      search: {
        publicId: search.publicId,
        step: search.step,
      },
    });
  },
});
