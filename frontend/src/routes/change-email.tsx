import { useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { confirmChangeEmail, getApiErrorMessage, openChangeEmailForm } from "@/libs/auth";
import type { ChangeEmailFormSession } from "@/libs/auth";
import { useAuthStore } from "@/stores/auth-store";

const searchSchema = z.object({
  token: z.string().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/change-email")({
  validateSearch: searchSchema,
  component: ChangeEmailPage,
});

const emailSchema = z.object({
  newEmail: z.email("Enter a valid email address."),
});

type EmailFormValues = z.infer<typeof emailSchema>;

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

function ChangeEmailPage() {
  const { token } = Route.useSearch();
  const setUser = useAuthStore((state) => state.setUser);
  const cancelledRef = useRef(false);
  const [session, setSession] = useState<ChangeEmailFormSession | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [loadMessage, setLoadMessage] = useState(
    token ? "Preparing change-email form…" : "Missing change-email token.",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    cancelledRef.current = false;

    void (async () => {
      try {
        const formSession = await openChangeEmailForm(token);

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

  const form = useForm({
    defaultValues: {
      newEmail: "",
    } satisfies EmailFormValues,
    validators: {
      onSubmit: emailSchema,
    },
    onSubmit: async ({ value }) => {
      if (!token || session == null) {
        return;
      }

      setFormError(null);

      try {
        const result = await confirmChangeEmail({
          token,
          form_id: session.form_id,
          xsrf_token: session.xsrf_token,
          new_email: value.newEmail,
        });

        if (result.user != null) {
          const current = useAuthStore.getState().user;

          if (current != null && current.id === result.user.id) {
            setUser({ ...current, ...result.user });
          }
        }

        setDoneMessage(result.detail);
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Change email</h1>

          <p className="text-sm text-muted-foreground">Choose a new address for your Velvet account.</p>
        </div>

        {loadStatus === "loading" ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {loadMessage}
          </p>
        ) : null}

        {loadStatus === "error" ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-destructive">{loadMessage}</p>

            <Button render={<Link to="/" />} variant="outline">
              Back home
            </Button>
          </div>
        ) : null}

        {loadStatus === "ok" && doneMessage != null ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{doneMessage}</p>

            <Button render={<Link to="/" />}>Continue</Button>
          </div>
        ) : null}

        {loadStatus === "ok" && doneMessage == null && session != null ? (
          <form
            className="space-y-4"
            onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <input type="hidden" name="form_id" value={session.form_id} />

            <input type="hidden" name="xsrf_token" value={session.xsrf_token} />

            <p className="text-sm text-muted-foreground">
              Current email: <span className="font-medium text-foreground">{session.current_email_masked}</span>
              {session.email_verified ? " (verified)" : " (unverified)"}
            </p>

            <FieldGroup>
              <form.Field name="newEmail">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>New email</FieldLabel>

                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        autoComplete="email"
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

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Update email"
                  )}
                </Button>
              )}
            </form.Subscribe>
          </form>
        ) : null}
      </div>
    </div>
  );
}
