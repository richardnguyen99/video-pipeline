import { useCallback, useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { changeUsername, getApiErrorMessage } from "@/libs/auth";
import type { UserProfile } from "@/libs/auth";
import { authQueryKeys } from "@/queries/auth";
import { userBioQueryKeys } from "@/queries/user-bio";
import { useAuthStore } from "@/stores/auth-store";

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(50, "Username must be at most 50 characters.")
    .regex(/^[A-Za-z0-9_]+$/, "Username may only contain letters, digits, and underscores."),
});

type UsernameFormValues = z.infer<typeof usernameSchema>;

type ChangeUsernameDialogProps = {
  open: boolean;
  currentUsername: string;
  onOpenChange: (open: boolean) => void;
};

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

export function ChangeUsernameDialog({ open, currentUsername, onOpenChange }: ChangeUsernameDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      username: currentUsername,
    } satisfies UsernameFormValues,
    validators: {
      onSubmit: usernameSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      const nextUsername = value.username.trim();

      if (nextUsername.toLowerCase() === currentUsername.toLowerCase()) {
        setFormError("New username must be different from the current username.");

        return;
      }

      try {
        const profile = await changeUsername(nextUsername);
        const previousUsername = currentUsername;
        const current = useAuthStore.getState().user;
        const next: UserProfile = current != null && current.id === profile.id ? { ...current, ...profile } : profile;

        queryClient.setQueryData(authQueryKeys.me(), next);
        queryClient.removeQueries({
          queryKey: userBioQueryKeys.byUsername(previousUsername),
        });
        queryClient.removeQueries({
          queryKey: ["user-profile", previousUsername],
        });

        router.history.replace(`/u/${encodeURIComponent(profile.username)}/security`);

        toast.add({
          type: "success",
          title: "Username updated",
          timeout: 3000,
        });

        onOpenChange(false);
        setUser(next);
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  const handleOpenChange = useCallback(
    (_open: boolean) => {
      onOpenChange(_open);

      if (!_open) {
        form.reset();
        setFormError(null);
      }
    },
    [form, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0">
        <div className="space-y-1.5 px-4 py-2">
          <DialogTitle className="text-lg font-semibold">Change username</DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground">
            Your username appears on your profile URL and public pages. Use 3–50 letters, digits, or underscores.
          </DialogDescription>
        </div>

        <form
          className="space-y-4 px-1"
          onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup className="px-4">
            <form.Field name="username">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>New username</FieldLabel>

                    <Input
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
                      autoFocus
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      aria-invalid={isInvalid || undefined}
                    />

                    {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>

          {formError ? <p className="text-sm text-destructive px-4">{formError}</p> : null}

          <DialogFooter className="border-t border-border py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>

            <form.Subscribe
              selector={(state) => ({
                isSubmitting: state.isSubmitting,
                username: state.values.username,
              })}
            >
              {({ isSubmitting, username }) => {
                const trimmed = username.trim();
                const isUnchanged = trimmed.toLowerCase() === currentUsername.toLowerCase();
                const isDisabled = isSubmitting || trimmed.length === 0 || isUnchanged;

                return (
                  <Button type="submit" disabled={isDisabled}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save username"
                    )}
                  </Button>
                );
              }}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
