import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { fieldErrors } from "@/layouts/user-profile/profile/bio-schema";
import type { BioStringFieldApi } from "@/layouts/user-profile/profile/bio-schema";
import { COUNTRY_ALPHA3_BY_LABEL, COUNTRY_LABEL_BY_ALPHA3, COUNTRY_LABELS } from "@/libs/country";

type CountryFieldProps = {
  field: BioStringFieldApi;
};

export function CountryField({ field }: CountryFieldProps) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const selectedLabel = (field.state.value ? COUNTRY_LABEL_BY_ALPHA3.get(field.state.value) : null) ?? null;

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>Country</FieldLabel>

      <Combobox
        items={COUNTRY_LABELS}
        value={selectedLabel}
        onValueChange={(label) => {
          if (label == null) {
            field.handleChange("");

            return;
          }

          field.handleChange(COUNTRY_ALPHA3_BY_LABEL.get(label) ?? "");
        }}
        autoHighlight
      >
        <ComboboxInput
          id={field.name}
          placeholder="Search country..."
          showClear
          aria-invalid={isInvalid || undefined}
          onBlur={field.handleBlur}
          className="w-full min-w-0"
        />

        <ComboboxContent>
          <ComboboxEmpty>No country found.</ComboboxEmpty>

          <ComboboxList>
            {(label) => (
              <ComboboxItem key={label} value={label}>
                {label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
    </Field>
  );
}
