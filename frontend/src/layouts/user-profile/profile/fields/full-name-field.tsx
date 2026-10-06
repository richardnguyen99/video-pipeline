import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldErrors } from "@/layouts/user-profile/profile/bio-schema";
import type { BioStringFieldApi } from "@/layouts/user-profile/profile/bio-schema";

type FullNameFieldProps = {
  field: BioStringFieldApi;
};

export function FullNameField({ field }: FullNameFieldProps) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>Full name</FieldLabel>

      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        autoComplete="name"
        aria-invalid={isInvalid || undefined}
      />

      {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
    </Field>
  );
}
