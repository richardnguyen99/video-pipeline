import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { countries } from "country-data-list";
import { CalendarIcon, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import { buttonVariants } from "@/libs/shadcn_variants";
import { cn } from "@/libs/utils";
import { type UserBio, updateMyUserBio, userBioQueryKeys } from "@/queries/user-bio";

const COUNTRY_OPTIONS = countries.all
  .filter((country) => country.status === "assigned" && Boolean(country.name))
  .map((country) => ({
    code: country.alpha2,
    name: country.name,
    emoji: country.emoji ?? "",
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const EMPTY_COUNTRY = "__none__";

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
  country: z.string().max(100),
  gender: z.string().max(50),
  biography: z.string().max(5000),
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
    biography: bio.biography ?? "",
    link: bio.link ?? "",
  };
}

function toUpdatePayload(values: BioFormValues) {
  return {
    full_name: values.full_name.trim() || null,
    date_of_birth: values.date_of_birth.trim() || null,
    country: values.country.trim() || null,
    gender: values.gender.trim() || null,
    biography: values.biography.trim() || null,
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
                                !selected && "text-muted-foreground",
                              )}
                              aria-invalid={isInvalid || undefined}
                              onBlur={field.handleBlur}
                            >
                              <span className="truncate text-left">
                                {selected ? format(selected, "PPP") : "Pick a date"}
                              </span>

                              <CalendarIcon className="size-4 shrink-0 opacity-50" aria-hidden />
                            </PopoverTrigger>

                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                captionLayout="dropdown"
                                selected={selected}
                                defaultMonth={selected}
                                disabled={{ after: new Date() }}
                                startMonth={new Date(1900, 0)}
                                endMonth={new Date()}
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
                      const selectValue = field.state.value || EMPTY_COUNTRY;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Country</FieldLabel>

                          <Select
                            value={selectValue}
                            onValueChange={(value) => {
                              if (value == null || value === EMPTY_COUNTRY) {
                                field.handleChange("");

                                return;
                              }

                              field.handleChange(value);
                            }}
                          >
                            <SelectTrigger
                              id={field.name}
                              className="w-full min-w-0"
                              aria-invalid={isInvalid || undefined}
                              onBlur={field.handleBlur}
                            >
                              <SelectValue placeholder="Select a country" />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value={EMPTY_COUNTRY}>None</SelectItem>

                                {COUNTRY_OPTIONS.map((country) => (
                                  <SelectItem key={country.code} value={country.name}>
                                    {country.emoji ? `${country.emoji} ` : ""}
                                    {country.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>

                          {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
                        </Field>
                      );
                    }}
                  />

                  <form.Field
                    name="gender"
                    children={(field) => {
                      const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Gender</FieldLabel>

                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            aria-invalid={isInvalid || undefined}
                          />

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
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            aria-invalid={isInvalid || undefined}
                          />

                          {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
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
    rows.push({ label: "Country", value: bio.country });
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

        {bio.biography ? <p className="text-sm whitespace-pre-wrap text-foreground/90">{bio.biography}</p> : null}
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
