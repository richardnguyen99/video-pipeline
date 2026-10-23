import { VISIBILITY_OPTIONS } from "@/layouts/video/studio/types";
import type { VisibilityValue } from "@/layouts/video/studio/types";
import { cn } from "@/libs/utils";

type VisibilityStepProps = {
  visibility: VisibilityValue;
  onVisibilityChange: (value: VisibilityValue) => void;
};

export function VisibilityStep({ visibility, onVisibilityChange }: VisibilityStepProps) {
  return (
    <div className="flex flex-col gap-3">
      {VISIBILITY_OPTIONS.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
            visibility === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
          )}
        >
          <input
            type="radio"
            name="visibility"
            value={option.value}
            checked={visibility === option.value}
            className="mt-1"
            onChange={() => {
              onVisibilityChange(option.value);
            }}
          />

          <span className="flex flex-col gap-0.5">
            <strong className="text-sm font-medium">{option.label}</strong>

            <small className="text-muted-foreground text-xs">{option.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
