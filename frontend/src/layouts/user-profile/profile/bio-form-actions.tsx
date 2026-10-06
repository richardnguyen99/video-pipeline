import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BioFormValues } from "@/layouts/user-profile/profile/bio-schema";
import { valuesEqual } from "@/layouts/user-profile/profile/bio-schema";

type BioFormActionsProps = {
  values: BioFormValues;
  baseline: BioFormValues;
  isPending: boolean;
  onReset: () => void;
};

export function BioFormActions({ values, baseline, isPending, onReset }: BioFormActionsProps) {
  const isDirty = !valuesEqual(values, baseline);

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!isDirty || isPending} onClick={onReset}>
        Reset
      </Button>

      <Button type="submit" size="sm" form="profile-bio-form" disabled={!isDirty || isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Saving
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </div>
  );
}
