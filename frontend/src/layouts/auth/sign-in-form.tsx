import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage, loginUser } from "@/libs/auth";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean(),
});

type SignInFormValues = z.infer<typeof signInSchema>;

const signInDefaultValues: SignInFormValues = {
  email: "",
  password: "",
  rememberMe: false,
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

type SignInFormProps = {
  redirectTo?: string;
};

export function SignInForm({ redirectTo }: SignInFormProps) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: signInDefaultValues,
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      try {
        const user = await loginUser({
          email: value.email,
          password: value.password,
          remember_me: value.rememberMe,
        });

        setUser(user);

        if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
          void navigate({ to: redirectTo, replace: true });

          return;
        }

        void navigate({ to: "/", replace: true });
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
    <form id="sign-in-form" onSubmit={handleSubmit} className="space-y-6" noValidate autoComplete="on">
      <FieldGroup>
        <form.Field
          name="email"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>

                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={255}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={isInvalid || undefined}
                  required
                />

                {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
              </Field>
            );
          }}
        />

        <form.Field
          name="password"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>

                  <Link to="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-active">
                    Forgot password?
                  </Link>
                </div>

                <PasswordInput
                  id={field.name}
                  name={field.name}
                  autoComplete="current-password"
                  maxLength={128}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={isInvalid || undefined}
                  required
                />

                {isInvalid ? <FieldError errors={fieldErrors(field.state.meta.errors)} /> : null}
              </Field>
            );
          }}
        />

        <form.Field
          name="rememberMe"
          children={(field) => (
            <Field orientation="horizontal" className="items-center gap-2">
              <input
                id={field.name}
                name={field.name}
                type="checkbox"
                className="size-4 shrink-0 rounded border border-input accent-primary"
                checked={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.checked)}
              />

              <FieldLabel htmlFor={field.name} className="font-normal">
                Remember me
              </FieldLabel>
            </Field>
          )}
        />
      </FieldGroup>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        children={([canSubmit, isSubmitting]) => (
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        )}
      />
    </form>
  );
}
