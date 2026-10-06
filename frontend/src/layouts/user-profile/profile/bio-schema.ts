import { format, parse } from "date-fns";
import { z } from "zod";

import type { UserBio } from "@/queries/user-bio";

export const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Lesbian",
  "Gay",
  "Bi-sexual",
  "Transgender",
  "Queer",
  "Intersex",
  "Agender",
  "Unknown",
] as const;

export const BIOGRAPHY_MAX_LENGTH = 500;

export const bioFormSchema = z.object({
  full_name: z.string().max(200),
  date_of_birth: z
    .string()
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Enter a valid date (YYYY-MM-DD).")
    .refine((value) => {
      if (value === "") {
        return true;
      }

      return new Date(value) <= new Date();
    }, "Date of birth cannot be in the future."),
  country: z
    .string()
    .max(3)
    .refine((value) => value === "" || /^[A-Z]{3}$/.test(value), "Country must be a 3-letter ISO alpha-3 code."),
  gender: z.string().max(50),
  biography: z.string().max(BIOGRAPHY_MAX_LENGTH),
  link: z
    .string()
    .max(2048)
    .refine((value) => {
      if (value === "") {
        return true;
      }

      try {
        const parsed = new URL(value);

        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Link must be an absolute http or https URL."),
});

export type BioFormValues = z.infer<typeof bioFormSchema>;

export type BioStringFieldApi = {
  name: string;
  state: {
    value: string;
    meta: {
      isTouched: boolean;
      isValid: boolean;
      errors: Array<unknown>;
    };
  };
  handleBlur: () => void;
  handleChange: (value: string) => void;
};

export function toFormValues(bio: UserBio): BioFormValues {
  return {
    full_name: bio.full_name ?? "",
    date_of_birth: bio.date_of_birth ?? "",
    country: bio.country ?? "",
    gender: bio.gender ?? "",
    biography: (bio.biography ?? "").replace(/[\r\n]+/g, " "),
    link: bio.link ?? "",
  };
}

export function toUpdatePayload(values: BioFormValues) {
  return {
    full_name: values.full_name.trim() || null,
    date_of_birth: values.date_of_birth.trim() || null,
    country: values.country.trim() || null,
    gender: values.gender.trim() || null,
    biography: values.biography.replace(/[\r\n]+/g, " ").trim() || null,
    link: values.link.trim() || null,
  };
}

export function valuesEqual(a: BioFormValues, b: BioFormValues): boolean {
  return (
    a.full_name.trim() === b.full_name.trim() &&
    a.date_of_birth.trim() === b.date_of_birth.trim() &&
    a.country.trim() === b.country.trim() &&
    a.gender.trim() === b.gender.trim() &&
    a.biography.trim() === b.biography.trim() &&
    a.link.trim() === b.link.trim()
  );
}

export function fieldErrors(errors: Array<unknown>): Array<{ message?: string } | undefined> {
  return errors.map((error) => {
    if (typeof error === "string") {
      return { message: error };
    }

    if (typeof error === "object" && error !== null && "message" in error) {
      return { message: String(error.message) };
    }

    return { message: String(error) };
  });
}

export function parseIsoDate(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date());

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export function formatIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
