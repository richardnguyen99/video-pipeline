import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import {
  COUNTRY_ALPHA3_BY_LABEL,
  COUNTRY_LABEL_BY_ALPHA3,
  COUNTRY_LABELS,
  resolveCountryDisplay,
} from "@/libs/country";
import { buttonVariants } from "@/libs/shadcn_variants";
import { cn } from "@/libs/utils";
import { updateMyUserBio, userBioQueryKeys } from "@/queries/user-bio";
import type { UserBio } from "@/queries/user-bio";

const GENDER_OPTIONS = [
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

const BIOGRAPHY_MAX_LENGTH = 500;

const bioFormSchema = z.object({
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

type BioFormValues = z.infer<typeof bioFormSchema>;

function toFormValues(bio: UserBio): BioFormValues {
  return {
    full_name: bio.full_name ?? "",
    date_of_birth: bio.date_of_birth ?? "",
    country: bio.country ?? "",
    gender: bio.gender ?? "",
    biography: (bio.biography ?? "").replace(/[\r\n]+/g, " "),
    link: bio.link ?? "",
  };
}

function toUpdatePayload(values: BioFormValues) {
  return {
    full_name: values.full_name.trim() || null,
    date_of_birth: values.date_of_birth.trim() || null,
    country: values.country.trim() || null,
    gender: values.gender.trim() || null,
    biography: values.biography.replace(/[\r\n]+/g, " ").trim() || null,
    link: values.link.trim() || null,
  };
}

function valuesEqual(a: BioFormValues, b: BioFormValues): boolean {
  return (
    a.full_name.trim() === b.full_name.trim() &&
    a.date_of_birth.trim() === b.date_of_birth.trim() &&
    a.country.trim() === b.country.trim() &&
    a.gender.trim() === b.gender.trim() &&
    a.biography.trim() === b.biography.trim() &&
    a.link.trim() === b.link.trim()
  );
}

function fieldErrors(errors: Array<unknown>): Array<{ message?: string } | undefined> {
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

function parseIsoDate(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date());

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function formatIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

type ProfileBioFormProps = {
  bio: UserBio;
  username: string;
};

export function ProfileBioForm({ bio, username }: ProfileBioFormProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [dobOpen, setDobOpen] = useState(false);
  const baseline = useMemo(() => toFormValues(bio), [bio]);
  const baselineDob = useMemo(() => parseIsoDate(baseline.date_of_birth), [baseline.date_of_birth]);

  const mutation = useMutation({
    mutationFn: updateMyUserBio,
    onSuccess: (next) => {
      queryClient.setQueryData(userBioQueryKeys.byUsername(username), next);
      queryClient.setQueryData(userBioQueryKeys.me, next);
    },
  });

  const form = useForm({
    defaultValues: baseline,
    validators: {
      onSubmit: bioFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      try {
        const next = await mutation.mutateAsync(toUpdatePayload(value));
        form.reset(toFormValues(next));
        toast.add({
          type: "success",
          title: "Profile updated",
          timeout: 4000,
        });
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  }

  return (
    <form id="profile-bio-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <form.Subscribe
        selector={(state) => state.values}
        children={(values) => {
          const isDirty = !valuesEqual(values, baseline);
          const isPending = form.state.isSubmitting || mutation.isPending;

          return (
            <SettingsCard
              title="Biography"
              description="These details are public on your profile. Leave any field blank to hide it."
              action={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!isDirty || isPending}
                    onClick={() => {
                      form.reset(baseline);
                      setFormError(null);
                      setDobOpen(false);
                    }}
                  >
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
              }
            >
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field
                    name="full_name"
                    children={(field) => {
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
                    }}
                  />

                  <form.Field
                    name="date_of_birth"
                    children={(field) => {
                      const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                      const selected = parseIsoDate(field.state.value);

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Date of birth</FieldLabel>

                          <Popover open={dobOpen} onOpenChange={setDobOpen} modal>
                            <PopoverTrigger
                              id={field.name}
                              type="button"
                              className={cn(
                                buttonVariants({ variant: "outline" }),
                                "w-full justify-between font-normal",
                              )}
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
                                  old: baselineDob ? [baselineDob] : [],
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
                    }}
                  />

                  <form.Field
                    name="country"
                    children={(field) => {
                      const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                      const selectedLabel =
                        (field.state.value ? COUNTRY_LABEL_BY_ALPHA3.get(field.state.value) : null) ?? null;

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
                    }}
                  />

                  <form.Field
                    name="gender"
                    children={(field) => {
                      const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                      const genderItems = [...GENDER_OPTIONS];
                      const selectedGender = genderItems.find((option) => option === field.state.value) ?? null;

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
                    }}
                  />

                  <form.Field
                    name="link"
                    children={(field) => {
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
                    }}
                  />

                  <form.Field
                    name="biography"
                    children={(field) => {
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
                    }}
                  />
                </div>

                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              </FieldGroup>
            </SettingsCard>
          );
        }}
      />
    </form>
  );
}

type ProfileBioPublicProps = {
  bio: UserBio;
};

export function ProfileBioPublic({ bio }: ProfileBioPublicProps) {
  const rows: Array<{ label: string; value: string }> = [];

  if (bio.full_name) {
    rows.push({ label: "Full name", value: bio.full_name });
  }

  if (bio.date_of_birth) {
    rows.push({ label: "Date of birth", value: bio.date_of_birth });
  }

  if (bio.country) {
    rows.push({
      label: "Country",
      value: resolveCountryDisplay(bio.country) ?? bio.country,
    });
  }

  if (bio.gender) {
    rows.push({ label: "Gender", value: bio.gender });
  }

  if (bio.link) {
    rows.push({ label: "Link", value: bio.link });
  }

  const hasContent = rows.length > 0 || Boolean(bio.biography);

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-5">
        <p className="text-sm font-medium">Public profile</p>

        <p className="mt-1 text-sm text-muted-foreground">This user has not shared a biography yet.</p>
      </div>
    );
  }

  return (
    <SettingsCard title="Biography" description="Public information this user has chosen to share.">
      <div className="flex flex-col gap-4">
        {rows.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{row.label}</dt>

                <dd className="text-sm">
                  {row.label === "Link" ? (
                    <a
                      href={row.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {bio.biography ? <p className="text-sm text-foreground/90">{bio.biography.replace(/[\r\n]+/g, " ")}</p> : null}
      </div>
    </SettingsCard>
  );
}

export function ProfileBioFallback() {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />

        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />

        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />

        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
