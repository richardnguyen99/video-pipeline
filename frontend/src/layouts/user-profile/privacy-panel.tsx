import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { SettingsSwitch } from "@/layouts/user-profile/settings-switch";
import { getApiErrorMessage } from "@/libs/auth";
import {
  myPrivacySettingsQueryOptions,
  privacySettingsQueryKeys,
  updateMyPrivacySettings,
} from "@/queries/privacy-settings";
import type { PrivacySettings, PrivacySettingsUpdateRequest } from "@/queries/privacy-settings";

type PrivacyToggleKey = keyof PrivacySettingsUpdateRequest;

const PRIVACY_ROWS: Array<{
  key: PrivacyToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "show_watched_videos",
    title: "Watched videos",
    description: "Let people see the videos you have watched.",
  },
  {
    key: "show_liked_videos",
    title: "Liked videos",
    description: "Let people see the videos you have liked.",
  },
  {
    key: "show_subscriptions",
    title: "Subscriptions",
    description: "Let people see the creators and actresses you follow.",
  },
  {
    key: "show_comment_history",
    title: "Comment history",
    description: "Let people see your public comment history.",
  },
];

function toUpdatePayload(settings: PrivacySettings): PrivacySettingsUpdateRequest {
  return {
    show_watched_videos: settings.show_watched_videos,
    show_liked_videos: settings.show_liked_videos,
    show_subscriptions: settings.show_subscriptions,
    show_comment_history: settings.show_comment_history,
  };
}

function payloadsEqual(a: PrivacySettingsUpdateRequest, b: PrivacySettingsUpdateRequest): boolean {
  return (
    a.show_watched_videos === b.show_watched_videos &&
    a.show_liked_videos === b.show_liked_videos &&
    a.show_subscriptions === b.show_subscriptions &&
    a.show_comment_history === b.show_comment_history
  );
}

type PrivacyPanelProps = {
  initialSettings?: PrivacySettings | null;
};

export function PrivacyPanel({ initialSettings = null }: PrivacyPanelProps) {
  const queryClient = useQueryClient();
  const { data, isError, error } = useQuery({
    ...myPrivacySettingsQueryOptions(),
    ...(initialSettings != null ? { initialData: initialSettings } : {}),
  });

  const seed = initialSettings != null ? toUpdatePayload(initialSettings) : data != null ? toUpdatePayload(data) : null;

  const [draft, setDraft] = useState<PrivacySettingsUpdateRequest | null>(seed);
  const lastSavedRef = useRef<PrivacySettingsUpdateRequest | null>(seed);
  const inFlightRef = useRef(0);

  useEffect(() => {
    if (data == null) {
      return;
    }

    const payload = toUpdatePayload(data);

    if (lastSavedRef.current == null) {
      lastSavedRef.current = payload;
      setDraft(payload);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: updateMyPrivacySettings,
    onMutate: () => {
      inFlightRef.current += 1;
    },
    onSuccess: (next) => {
      const payload = toUpdatePayload(next);
      lastSavedRef.current = payload;
      queryClient.setQueryData(privacySettingsQueryKeys.me(), next);
    },
    onError: (mutationError) => {
      if (lastSavedRef.current != null) {
        setDraft(lastSavedRef.current);
      }

      toast.add({
        type: "error",
        title: "Could not save privacy settings",
        description: getApiErrorMessage(mutationError),
        timeout: 4000,
      });
    },
    onSettled: () => {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    },
  });

  const applyChange = (nextDraft: PrivacySettingsUpdateRequest) => {
    setDraft(nextDraft);

    const saved = lastSavedRef.current;

    if (saved != null && payloadsEqual(nextDraft, saved)) {
      return;
    }

    updateMutation.mutate(nextDraft);
  };

  const display =
    draft ??
    (data != null ? toUpdatePayload(data) : null) ??
    (initialSettings != null ? toUpdatePayload(initialSettings) : null);

  if (display == null) {
    if (isError) {
      return (
        <p className="text-sm text-destructive" role="alert">
          {getApiErrorMessage(error)}
        </p>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading privacy settings…
      </div>
    );
  }

  return (
    <SettingsCard
      title="Privacy controls"
      description="Choose which parts of your activity are visible on your public profile."
    >
      <div className="flex flex-col divide-y divide-border/50">
        {PRIVACY_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.title}</p>

              <p className="text-sm text-muted-foreground">{row.description}</p>
            </div>

            <SettingsSwitch
              checked={display[row.key]}
              label={row.title}
              onCheckedChange={(checked) => {
                applyChange({
                  ...display,
                  [row.key]: checked,
                });
              }}
            />
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
