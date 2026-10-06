import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fieldErrors, formatIsoDate, parseIsoDate } from "@/layouts/user-profile/profile/bio-schema";
import type { BioStringFieldApi } from "@/layouts/user-profile/profile/bio-schema";
import { buttonVariants } from "@/libs/shadcn_variants";
import { cn } from "@/libs/utils";

type DateOfBirthFieldProps = {
  field: BioStringFieldApi;
  baselineDate?: Date;
};

export function DateOfBirthField({ field, baselineDate }: DateOfBirthFieldProps) {
  const [open, setOpen] = useState(false);
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const selected = parseIsoDate(field.state.value);

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>Date of birth</FieldLabel>

      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger
          id={field.name}
          type="button"
          className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
          aria-invalid={isInvalid || undefined}
          onBlur={field.handleBlur}
        >
          <span
            className={cn(
              "truncate text-left transition-opacity",
              selected
                ? "text-muted-foreground opacity-80 hover:opacity-100"
                : "text-muted-foreground/70 opacity-80 hover:opacity-100",
            )}
          >
            {selected ? format(selected, "PPP") : "Pick a date"}
          </span>

          <CalendarIcon className="size-4 shrink-0 text-muted-foreground opacity-80" aria-hidden />
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" side="bottom" align="end" sideOffset={4}>
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected}
            disabled={{ after: new Date() }}
            startMonth={new Date(1900, 0)}
            endMonth={new Date()}
            modifiers={{
              old: baselineDate ? [baselineDate] : [],
            }}
            onSelect={(date) => {
              field.handleChange(date ? formatIsoDate(date) : "");
            }}
          />
        </PopoverContent>
      </Popover>

      {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
    </Field>
  );
}
