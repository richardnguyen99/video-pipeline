import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldErrors } from "@/layouts/user-profile/profile/bio-schema";
import type { BioStringFieldApi } from "@/layouts/user-profile/profile/bio-schema";

type LinkFieldProps = {
  field: BioStringFieldApi;
};

export function LinkField({ field }: LinkFieldProps) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid || undefined} className="sm:col-span-2">
      <FieldLabel htmlFor={field.name}>Link</FieldLabel>

      <Input
        id={field.name}
        name={field.name}
        type="url"
        placeholder="https://"
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        autoComplete="url"
        aria-invalid={isInvalid || undefined}
      />

      {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
    </Field>
  );
}
