import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { bioFormSchema, parseIsoDate, toFormValues, toUpdatePayload } from "@/layouts/user-profile/profile/bio-schema";
import { BioFormActions } from "@/layouts/user-profile/profile/bio-form-actions";
import { BiographyField } from "@/layouts/user-profile/profile/fields/biography-field";
import { CountryField } from "@/layouts/user-profile/profile/fields/country-field";
import { DateOfBirthField } from "@/layouts/user-profile/profile/fields/date-of-birth-field";
import { FullNameField } from "@/layouts/user-profile/profile/fields/full-name-field";
import { GenderField } from "@/layouts/user-profile/profile/fields/gender-field";
import { LinkField } from "@/layouts/user-profile/profile/fields/link-field";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import { updateMyUserBio, userBioQueryKeys } from "@/queries/user-bio";
import type { UserBio } from "@/queries/user-bio";

type BioFormProps = {
  bio: UserBio;
  username: string;
};

export function BioForm({ bio, username }: BioFormProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
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

  function handleReset() {
    form.reset(baseline);
    setFormError(null);
  }

  return (
    <form id="profile-bio-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <form.Subscribe
        selector={(state) => state.values}
        children={(values) => {
          const isPending = form.state.isSubmitting || mutation.isPending;

          return (
            <SettingsCard
              title="Biography"
              description="These details are public on your profile. Leave any field blank to hide it."
              action={
                <BioFormActions values={values} baseline={baseline} isPending={isPending} onReset={handleReset} />
              }
            >
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field name="full_name" children={(field) => <FullNameField field={field} />} />

                  <form.Field
                    name="date_of_birth"
                    children={(field) => <DateOfBirthField field={field} baselineDate={baselineDob} />}
                  />

                  <form.Field name="country" children={(field) => <CountryField field={field} />} />

                  <form.Field name="gender" children={(field) => <GenderField field={field} />} />

                  <form.Field name="link" children={(field) => <LinkField field={field} />} />

                  <form.Field name="biography" children={(field) => <BiographyField field={field} />} />
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
