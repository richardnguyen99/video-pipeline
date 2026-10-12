import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage, requestChangeEmailLink } from "@/libs/auth";

export function ChangeEmailRequestButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const result = await requestChangeEmailLink();
      setMessage(result.detail);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          void handleRequest();
        }}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          "Change email"
        )}
      </Button>

      {message ? <p className="max-w-xs text-right text-xs text-muted-foreground">{message}</p> : null}

      {error ? <p className="max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
