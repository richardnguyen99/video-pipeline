import { useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { SettingsSwitch } from "@/layouts/user-profile/settings-switch";

type NotificationKey = "followedVideos" | "publicVideoActivity" | "publicPlaylistActivity" | "commentReplies";

const NOTIFICATION_ROWS: Array<{
  key: NotificationKey;
  title: string;
  description: string;
}> = [
  {
    key: "followedVideos",
    title: "New videos from followed creators",
    description: "Get notified when a creator or actress you follow shares something new.",
  },
  {
    key: "publicVideoActivity",
    title: "Likes and comments on public uploaded videos",
    description: "Stay informed when people interact with your public videos.",
  },
  {
    key: "publicPlaylistActivity",
    title: "Likes and comments on public playlists",
    description: "Stay informed when people interact with your public playlists.",
  },
  {
    key: "commentReplies",
    title: "Likes and replies on previous comments",
    description: "Know when someone responds to a comment you have left.",
  },
];

export function NotificationsPanel() {
  const [language, setLanguage] = useState("English");
  const [settings, setSettings] = useState<Record<NotificationKey, boolean>>({
    followedVideos: true,
    publicVideoActivity: true,
    publicPlaylistActivity: false,
    commentReplies: true,
  });

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Preferred language"
        description="Choose the language used for account notices and recommendations."
        action={
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-36" aria-label="Preferred language">
              <SelectValue placeholder="Language" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="English">English</SelectItem>

              <SelectItem value="Spanish">Spanish</SelectItem>

              <SelectItem value="French">French</SelectItem>

              <SelectItem value="Japanese">Japanese</SelectItem>

              <SelectItem value="German">German</SelectItem>
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
                checked={settings[row.key]}
                label={row.title}
                onCheckedChange={(checked) => {
                  setSettings((current) => ({
                    ...current,
                    [row.key]: checked,
                  }));
                }}
              />
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
