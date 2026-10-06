import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { BIOGRAPHY_MAX_LENGTH, fieldErrors } from "@/layouts/user-profile/profile/bio-schema";
import type { BioStringFieldApi } from "@/layouts/user-profile/profile/bio-schema";
import { cn } from "@/libs/utils";

type BiographyFieldProps = {
  field: BioStringFieldApi;
};

export function BiographyField({ field }: BiographyFieldProps) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid || undefined} className="sm:col-span-2">
      <FieldLabel htmlFor={field.name}>Biography</FieldLabel>

      <Textarea
        id={field.name}
        name={field.name}
        rows={4}
        maxLength={BIOGRAPHY_MAX_LENGTH}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value.replace(/[\r\n]+/g, " "));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        aria-invalid={isInvalid || undefined}
      />

      <div className="flex items-center justify-between gap-2">
        {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : <span />}

        <p
          className={cn(
            "text-xs tabular-nums text-muted-foreground",
            field.state.value.length >= BIOGRAPHY_MAX_LENGTH && "text-destructive",
          )}
        >
          {field.state.value.length}/{BIOGRAPHY_MAX_LENGTH}
        </p>
      </div>
    </Field>
  );
}
