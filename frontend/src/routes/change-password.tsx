import { useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  confirmChangePasswordLink,
  getApiErrorMessage,
  openChangePasswordForm,
  verifyChangePasswordCurrent,
} from "@/libs/auth";
import type { ChangePasswordFormSession } from "@/libs/auth";
import { applyAuthSession } from "@/libs/auth-session";
import { useAuthStore } from "@/stores/auth-store";

const searchSchema = z.object({
  token: z.string().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/change-password")({
  validateSearch: searchSchema,
  component: ChangePasswordPage,
});

const currentPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
});

const newPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
      .regex(/[0-9]/, "Password must include at least one number.")
      .regex(/[^A-Za-z0-9]/, "Password must include at least one special character."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type CurrentPasswordValues = z.infer<typeof currentPasswordSchema>;
type NewPasswordValues = z.infer<typeof newPasswordSchema>;

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

function ChangePasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clearUser = useAuthStore((state) => state.clearUser);
  const cancelledRef = useRef(false);
  const [session, setSession] = useState<ChangePasswordFormSession | null>(null);
  const [step, setStep] = useState<"verify" | "new">("verify");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [loadMessage, setLoadMessage] = useState(
    token ? "Preparing password-change form…" : "Missing password-change token.",
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    cancelledRef.current = false;

    void (async () => {
      try {
        const formSession = await openChangePasswordForm(token);

        if (cancelledRef.current) {
          return;
        }

        setSession(formSession);
        setLoadStatus("ok");
        setLoadMessage("");
      } catch (error) {
        if (cancelledRef.current) {
          return;
        }

        setLoadStatus("error");
        setLoadMessage(getApiErrorMessage(error));
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [token]);

  async function signOutAndGoLogin() {
    applyAuthSession(queryClient, null);
    clearUser();
    await navigate({ to: "/sign-in", replace: true });
  }

  const verifyForm = useForm({
    defaultValues: {
      currentPassword: "",
    } satisfies CurrentPasswordValues,
    validators: {
      onSubmit: currentPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      if (!token || session == null) {
        return;
      }

      setFormError(null);

      try {
        const result = await verifyChangePasswordCurrent({
          token,
          form_id: session.form_id,
          xsrf_token: session.xsrf_token,
          current_password: value.currentPassword,
        });

        if (result.locked_out) {
          setFormError(result.detail);
          await signOutAndGoLogin();

          return;
        }

        if (!result.success) {
          setFormError(result.detail);

          return;
        }

        setStep("new");
        setFormError(null);
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  const newForm = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    } satisfies NewPasswordValues,
    validators: {
      onSubmit: newPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      if (!token || session == null) {
        return;
      }

      setFormError(null);

      try {
        await confirmChangePasswordLink({
          token,
          form_id: session.form_id,
          xsrf_token: session.xsrf_token,
          new_password: value.newPassword,
        });
        await signOutAndGoLogin();
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Change password</h1>

        <p className="text-sm text-muted-foreground">
          {step === "verify" ? "Confirm your current password to continue." : "Choose a new password for your account."}
        </p>
      </div>

      {loadStatus === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {loadMessage}
        </p>
      ) : null}

      {loadStatus === "error" ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{loadMessage}</p>

          <Button nativeButton={false} variant="outline" render={<Link to="/sign-in" />}>
            Back to sign in
          </Button>
        </div>
      ) : null}

      {loadStatus === "ok" && step === "verify" ? (
        <form
          className="space-y-4"
          onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
            event.preventDefault();
            event.stopPropagation();
            void verifyForm.handleSubmit();
          }}
        >
          <FieldGroup>
            <verifyForm.Field name="currentPassword">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Current password</FieldLabel>

                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="current-password"
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
            </verifyForm.Field>
          </FieldGroup>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <verifyForm.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Checking…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            )}
          </verifyForm.Subscribe>
        </form>
      ) : null}

      {loadStatus === "ok" && step === "new" ? (
        <form
          className="space-y-4"
          onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
            event.preventDefault();
            event.stopPropagation();
            void newForm.handleSubmit();
          }}
        >
          <FieldGroup>
            <newForm.Field name="newPassword">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>New password</FieldLabel>

                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
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
            </newForm.Field>

            <newForm.Field name="confirmPassword">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Confirm new password</FieldLabel>

                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      autoComplete="new-password"
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
            </newForm.Field>
          </FieldGroup>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <newForm.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            )}
          </newForm.Subscribe>
        </form>
      ) : null}
    </div>
  );
}
