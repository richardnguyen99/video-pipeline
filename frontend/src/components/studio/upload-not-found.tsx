import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

type UploadNotFoundProps = {
  title?: string;
  description?: string;
};

export function UploadNotFound({
  title = "Upload not found",
  description = "This upload could not be loaded. It may have been removed or you may not have access.",
}: UploadNotFoundProps) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-xl border p-6">
      <h1 className="text-lg font-semibold">{title}</h1>

      <p className="text-muted-foreground text-sm">{description}</p>

      <Button
        type="button"
        variant="outline"
        className="w-fit"
        nativeButton={false}
        render={<Link to="/studio/uploads" />}
      >
        Back to uploads
      </Button>
    </section>
  );
}
