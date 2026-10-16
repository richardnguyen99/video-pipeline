import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { SettingsSwitch } from "@/layouts/user-profile/settings-switch";
import { getApiErrorMessage } from "@/libs/auth";
import {
  myNotificationSettingsQueryOptions,
  notificationSettingsQueryKeys,
  updateMyNotificationSettings,
} from "@/queries/notification-settings";
import type {
  NotificationSettings,
  NotificationSettingsUpdateRequest,
  PreferredLanguage,
} from "@/queries/notification-settings";

type NotificationToggleKey = Exclude<keyof NotificationSettingsUpdateRequest, "preferred_language">;

const LANGUAGE_OPTIONS: Array<{ value: PreferredLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ja", label: "Japanese" },
  { value: "de", label: "German" },
];

const NOTIFICATION_ROWS: Array<{
  key: NotificationToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "notify_followed_videos",
    title: "New videos from followed creators",
    description: "Get notified when a creator or actress you follow shares something new.",
  },
  {
    key: "notify_public_video_activity",
    title: "Likes and comments on public uploaded videos",
    description: "Stay informed when people interact with your public videos.",
  },
  {
    key: "notify_public_playlist_activity",
    title: "Likes and comments on public playlists",
    description: "Stay informed when people interact with your public playlists.",
  },
  {
    key: "notify_comment_replies",
    title: "Likes and replies on previous comments",
    description: "Know when someone responds to a comment you have left.",
  },
];

function toUpdatePayload(settings: NotificationSettings): NotificationSettingsUpdateRequest {
  return {
    preferred_language: settings.preferred_language,
    notify_followed_videos: settings.notify_followed_videos,
    notify_public_video_activity: settings.notify_public_video_activity,
    notify_public_playlist_activity: settings.notify_public_playlist_activity,
    notify_comment_replies: settings.notify_comment_replies,
  };
}

type NotificationsPanelProps = {
  initialSettings?: NotificationSettings | null;
};

export function NotificationsPanel({ initialSettings = null }: NotificationsPanelProps) {
  const queryClient = useQueryClient();
  const { data, isError, error } = useQuery({
    ...myNotificationSettingsQueryOptions(),
    ...(initialSettings != null ? { initialData: initialSettings } : {}),
  });

  const updateMutation = useMutation({
    mutationFn: updateMyNotificationSettings,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: notificationSettingsQueryKeys.me(),
      });
      const previous = queryClient.getQueryData<NotificationSettings>(notificationSettingsQueryKeys.me());

      if (previous != null) {
        queryClient.setQueryData<NotificationSettings>(notificationSettingsQueryKeys.me(), {
          ...previous,
          ...payload,
        });
      }

      return { previous };
    },
    onError: (mutationError, _payload, context) => {
      if (context?.previous != null) {
        queryClient.setQueryData(notificationSettingsQueryKeys.me(), context.previous);
      }

      toast.add({
        type: "error",
        title: "Could not save notification settings",
        description: getApiErrorMessage(mutationError),
        timeout: 4000,
      });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(notificationSettingsQueryKeys.me(), next);
    },
  });

  if (!data) {
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
        Loading notification settings…
      </div>
    );
  }

  const pending = updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Preferred language"
        description="Choose the language used for account notices and recommendations."
        action={
          <Select
            value={data.preferred_language}
            disabled={pending}
            onValueChange={(value) => {
              if (value == null) {
                return;
              }

              updateMutation.mutate({
                ...toUpdatePayload(data),
                preferred_language: value,
              });
            }}
          >
            <SelectTrigger className="w-36" aria-label="Preferred language">
              <SelectValue placeholder="Language" />
            </SelectTrigger>

            <SelectContent>
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <SettingsCard
        title="Activity notifications"
        description="Choose which updates you would like to receive from Velvet."
      >
        <div className="flex flex-col divide-y divide-border/50">
          {NOTIFICATION_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.title}</p>

                <p className="text-sm text-muted-foreground">{row.description}</p>
              </div>

              <SettingsSwitch
                checked={data[row.key]}
                label={row.title}
                disabled={pending}
                onCheckedChange={(checked) => {
                  updateMutation.mutate({
                    ...toUpdatePayload(data),
                    [row.key]: checked,
                  });
                }}
              />
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
