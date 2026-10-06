import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { fieldErrors, GENDER_OPTIONS } from "@/layouts/user-profile/profile/bio-schema";
import type { BioStringFieldApi } from "@/layouts/user-profile/profile/bio-schema";

type GenderFieldProps = {
  field: BioStringFieldApi;
};

export function GenderField({ field }: GenderFieldProps) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const genderItems = [...GENDER_OPTIONS];
  const selectedGender =
    field.state.value && (GENDER_OPTIONS as ReadonlyArray<string>).includes(field.state.value)
      ? field.state.value
      : null;

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>Gender</FieldLabel>

      <Combobox
        items={genderItems}
        value={selectedGender}
        onValueChange={(value) => {
          field.handleChange(value ?? "");
        }}
        autoHighlight
      >
        <ComboboxInput
          id={field.name}
          placeholder="Search gender..."
          showClear
          aria-invalid={isInvalid || undefined}
          onBlur={field.handleBlur}
          className="w-full min-w-0"
        />

        <ComboboxContent>
          <ComboboxEmpty>No gender found.</ComboboxEmpty>

          <ComboboxList>
            {(option) => (
              <ComboboxItem key={option} value={option}>
                {option}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
    </Field>
  );
}
