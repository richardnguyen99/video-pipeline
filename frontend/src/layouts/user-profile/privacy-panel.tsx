import { useState } from "react";

import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { SettingsSwitch } from "@/layouts/user-profile/settings-switch";

type PrivacyKey = "watchedVideos" | "likedVideos" | "subscriptions" | "commentHistory";

const PRIVACY_ROWS: Array<{
  key: PrivacyKey;
  title: string;
  description: string;
}> = [
  {
    key: "watchedVideos",
    title: "Watched videos",
    description: "Let people see the videos you have watched.",
  },
  {
    key: "likedVideos",
    title: "Liked videos",
    description: "Let people see the videos you have liked.",
  },
  {
    key: "subscriptions",
    title: "Subscriptions",
    description: "Let people see the creators and actresses you follow.",
  },
  {
    key: "commentHistory",
    title: "Comment history",
    description: "Let people see your public comment history.",
  },
];

export function PrivacyPanel() {
  const [settings, setSettings] = useState<Record<PrivacyKey, boolean>>({
    watchedVideos: false,
    likedVideos: false,
    subscriptions: true,
    commentHistory: true,
  });

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
  );
}
