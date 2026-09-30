import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/libs/api-client";
import { getApiErrorMessage, requestEmailVerification } from "@/libs/auth";
import type { UserProfile } from "@/libs/auth";
import { HttpStatus } from "@/libs/http-status";

const DEFAULT_COOLDOWN_SECONDS = 5 * 60;
const COOLDOWN_STORAGE_PREFIX = "velvet-email-verify-cooldown:";

function cooldownStorageKey(userId: string): string {
  return `${COOLDOWN_STORAGE_PREFIX}${userId}`;
}

function readCooldownEndsAt(userId: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cooldownStorageKey(userId));

    if (raw == null || raw === "") {
      return null;
    }

    const endsAt = Number.parseInt(raw, 10);

    if (!Number.isFinite(endsAt) || endsAt <= Date.now()) {
      window.sessionStorage.removeItem(cooldownStorageKey(userId));

      return null;
    }

    return endsAt;
  } catch {
    return null;
  }
}

function writeCooldownEndsAt(userId: string, endsAt: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(cooldownStorageKey(userId), String(endsAt));
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

function clearCooldownEndsAt(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(cooldownStorageKey(userId));
  } catch {
    // Ignore.
  }
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;

  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}

type EmailVerificationBannerProps = {
  user: UserProfile;
};

export function EmailVerificationBanner({ user }: EmailVerificationBannerProps) {
  const [pending, setPending] = useState(false);
  const [sentOnce, setSentOnce] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(() => readCooldownEndsAt(user.id));
  const [nowMs, setNowMs] = useState(() => Date.now());

  const remainingSeconds = useMemo(() => {
    if (cooldownEndsAt == null) {
      return 0;
    }

    return Math.max(0, Math.ceil((cooldownEndsAt - nowMs) / 1000));
  }, [cooldownEndsAt, nowMs]);

  const isCoolingDown = remainingSeconds > 0;

  useEffect(() => {
    if (cooldownEndsAt == null) {
      return;
    }

    const timerId = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);

      if (cooldownEndsAt <= now) {
        setCooldownEndsAt(null);
        clearCooldownEndsAt(user.id);
      }
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [cooldownEndsAt, user.id]);

  const startCooldown = useCallback(
    (seconds: number) => {
      const duration = Math.max(1, seconds);
      const endsAt = Date.now() + duration * 1000;

      setCooldownEndsAt(endsAt);
      setNowMs(Date.now());
      writeCooldownEndsAt(user.id, endsAt);
    },
    [user.id],
  );

  async function handleSend() {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const result = await requestEmailVerification();
      setSentOnce(true);
      setMessage(result.detail);
      startCooldown(DEFAULT_COOLDOWN_SECONDS);
    } catch (err) {
      setError(getApiErrorMessage(err));

      if (err instanceof ApiError && err.status === HttpStatus.TOO_MANY_REQUESTS) {
        setSentOnce(true);
        startCooldown(err.retryAfterSeconds ?? DEFAULT_COOLDOWN_SECONDS);
      }
    } finally {
      setPending(false);
    }
  }

  const buttonLabel = (() => {
    if (pending) {
      return sentOnce ? "Resending…" : "Sending…";
    }

    if (isCoolingDown) {
      return `Resend in ${formatCountdown(remainingSeconds)}`;
    }

    if (sentOnce) {
      return "Resend verification email";
    }

    return "Send verification email";
  })();

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />

        <div className="space-y-1">
          <p className="font-medium text-foreground">Verify your email</p>

          <p className="text-muted-foreground">
            Confirm <span className="font-medium text-foreground">{user.email}</span> to secure your account. The link
            expires in 15 minutes.
          </p>
        </div>
      </div>

      {message ? (
        <p className="text-foreground" role="status">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="sm"
        disabled={pending || isCoolingDown}
        onClick={() => {
          void handleSend();
        }}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {buttonLabel}
          </>
        ) : (
          buttonLabel
        )}
      </Button>
    </div>
  );
}
