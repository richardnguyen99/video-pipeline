import { useState } from "react";
import type { FormEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage, loginUser } from "@/libs/auth";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type SignInFormValues = z.infer<typeof signInSchema>;

function fieldErrors(errors: unknown[]): Array<{ message?: string } | undefined> {
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
    defaultValues: {
      email: "",
      password: "",
    } satisfies SignInFormValues,
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      try {
        const user = await loginUser({
          email: value.email,
          password: value.password,
        });

        setUser(user);

        if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
          window.location.assign(redirectTo);

          return;
        }

        void navigate({ to: "/" });
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>

                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
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
